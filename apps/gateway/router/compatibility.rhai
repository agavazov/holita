fn valid_request_id(value) {
    if value.len() == 0 || value.len() > 100 { return false; }
    for character in value.chars() {
        if !"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-".contains(character) {
            return false;
        }
    }
    true
}

fn valid_field_path(value) {
    if type_of(value) != "string" || value.len() == 0 { return false; }
    if !"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".contains(value[0]) { return false; }
    for character in value.chars() {
        if !"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".contains(character) {
            return false;
        }
    }
    true
}

fn valid_field_message(value) {
    if type_of(value) != "string" { return false; }
    // Match JavaScript's UTF-16 length, including supplementary Unicode characters.
    let length = 0;
    for character in value.chars() {
        length += if character.to_int() > 65535 { 2 } else { 1 };
        if length > 300 { return false; }
    }
    true
}

fn public_field_errors(value) {
    let result = [];
    if type_of(value) != "array" { return result; }
    let inspected = 0;
    for entry in value {
        if inspected == 30 { break; }
        inspected += 1;
        if type_of(entry) == "map" && valid_field_path(entry.path) && valid_field_message(entry.message) {
            result.push(#{path: entry.path, message: entry.message});
        }
    }
    result
}

fn is_transport_error(code) {
    ["SUBREQUEST_HTTP_ERROR", "SUBREQUEST_MALFORMED_RESPONSE", "SUBREQUEST_UNEXPECTED_PATCH_RESPONSE", "GATEWAY_TIMEOUT"].contains(code)
}

fn public_error(error, request_id) {
    let original = error.extensions;
    let code = if type_of(original) == "map" { original.code } else { () };
    if code == "VALIDATION_INVALID_TYPE_VARIABLE" {
        code = "BAD_USER_INPUT";
    } else if is_transport_error(code) {
        error.message = "A required service is unavailable; try again later";
        code = "SERVICE_UNAVAILABLE";
    } else if !["BAD_USER_INPUT", "UNAUTHENTICATED", "NOT_FOUND", "CONFLICT", "SERVICE_UNAVAILABLE", "GRAPHQL_PARSE_FAILED", "GRAPHQL_VALIDATION_FAILED", "BAD_REQUEST"].contains(code) {
        error.message = "Internal server error";
        code = "INTERNAL_SERVER_ERROR";
        log_error(`requestId=${request_id} error=INTERNAL_SERVER_ERROR`);
    }
    error.extensions = #{code: code, requestId: request_id};
    if code == "BAD_USER_INPUT" {
        error.extensions.fieldErrors = public_field_errors(original.fieldErrors);
    }
    error
}

fn subgraph_service(service, subgraph) {
    service.map_response(|response| {
        let errors = [];
        let transport_failure = false;
        for error in response.body.errors {
            if type_of(error.extensions) == "map" && is_transport_error(error.extensions.code) {
                // Router can report both HTTP and JSON failures for the same fetch.
                if transport_failure { continue; }
                transport_failure = true;
            }
            errors.push(error);
        }
        response.body.errors = errors;
    });
}

fn supergraph_service(service) {
    service.map_request(|request| {
        let supplied = request.headers.values("x-request-id");
        let request_id = if supplied.len() == 1 && valid_request_id(supplied[0]) {
            supplied[0]
        } else {
            uuid_v4()
        };
        request.context["holita.request_id"] = request_id;
        request.headers["x-request-id"] = request_id;
    });
    service.map_response(|response| {
        let request_id = response.context["holita.request_id"];
        if response.is_primary() { response.headers["x-request-id"] = request_id; }
        let errors = [];
        for error in response.body.errors {
            errors.push(public_error(error, request_id));
        }
        response.body.errors = errors;
    });
}
