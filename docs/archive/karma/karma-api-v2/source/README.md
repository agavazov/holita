# Vendor sources and response evidence

The following files are unmodified downloads of public vendor documentation:

| File                             | Original URL                              | Role                                                                |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| [index.html](index.html.txt)     | <https://karma.online/apiv2/>             | API help shell and login form                                       |
| [endpoints.js](endpoints.js.txt) | <https://karma.online/apiv2/endpoints.js> | Endpoint/method/form-field inventory                                |
| [help.js](help.js.txt)           | <https://karma.online/apiv2/help.js>      | Form serialization, path substitution, session and request handling |
| [help.css](help.css.txt)         | <https://karma.online/apiv2/help.css>     | Original help presentation                                          |

[manifest.json](manifest.json) records their retrieval time, HTTP metadata, byte
lengths, SHA-256 hashes and the checked OpenAPI discovery addresses. Keep source
assets byte-for-byte; do not run a formatter over these files. They remain vendor
material with the copyright notice in the original HTML.

[response-shapes.json](response-shapes.json) is locally derived structural evidence,
not a downloaded API schema or a raw-response archive. It retains field names and
observed JSON types, including nested profile categories and the eData field union.
Account counts, identifiers, text values, coordinates, readings, credentials and
session IDs are excluded. An observation's nullability or empty array is not an
exhaustive description of the provider's possible values.

[edata-parameter-metadata.json](edata-parameter-metadata.json) is a separate partial
catalog of encountered parameter IDs, original descriptions and value types.
Parameter IDs are metadata identifiers, not car/account identities. This artifact
contains no actual readings and is not a complete parameter or unit dictionary.
Its human-readable form is [Observed eData parameters](../observed-parameters.md).

Public assets use a `.txt` archive suffix so external scripts and markup remain
reference data outside executable-source linting and formatting. The downloaded
bytes and original filenames are preserved in the manifest.

These files support the [reconstructed OpenAPI](../openapi.reconstructed.json).
Original help metadata describes request forms; it does not supply formal response
schemas, a complete error catalog or business guarantees. Inspect scripts as source;
the help page can make real authenticated requests when used interactively.
