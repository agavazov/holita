# ERM support correspondence: diagnostics, protocol access and Test Server

**Historical source assessment (27 October).** The [29 October follow-up](reply-2026-10-29.md) and [current live evidence](live-verification-2026-10-29.md) supersede missing portal credentials, absence of positive 419 reports and any use of 154,0 as successful empty-fault evidence. Original material below is preserved with its original date and scope.

[Reference and verification status](README.md) · [Analysis and images](analysis.md) ·
[Original reply](source/erm-support-reply.odt)

This preserves the original request supplied by the user and the reply exported in the ODT.
The ODT has no email headers. During ERM-TEST-01, the matching Outlook message
was found with sender **Oz Dori, oz@erm.co.il**, subject **RE: Device diagnostics,
protocol access and StarLink Test Server**, received **2026-10-25 08:39:01 UTC**.
The received timestamp does not establish an exact sending timestamp. The reference
date, 2026-10-27, is the analysis date. Statements below are attributed to ERM; they do not
establish successful live tests in discocan.

## Original request

> Hi Oz,
>
> I’d like to arrange another meeting next week to discuss the topics listed below. Please let me know when you would be available.
>
> We are developing our own server integration for ERM devices and would appreciate your help with the following:
>
> 1. Reading device errors and diagnostic information
>
> - How can we retrieve errors and diagnostic information from the devices, including vehicle fault codes (DTCs), where supported?
> - Are these reported automatically, or do we need to send specific commands?
> - Could you share the relevant commands, message formats, error code descriptions and example requests/responses?
> - Are there any model, firmware or configuration requirements for these features?
>
> 2. Access to the protocol documentation
>
> Could you provide credentials for your https://sweb.erm.co.il/protocol/?
>
> Please also point us to the documentation relevant to receiving device messages, sending commands and reading diagnostic information.
>
> 3. StarLink Test Server and device configuration
>
> Could you send us the StarLink Test Server, together with installation instructions?
>
> We would like to use it to inspect and replay device messages and help us develop our own server. Could you clarify:
>
> - Can it capture, replay or simulate device messages? Are sample messages or recordings available?
> - Do you have implementation notes or a reference flow covering connection setup, message parsing, acknowledgements and command responses?
> - How do we configure devices to connect to the test server? Please provide the required commands or configuration steps for the server address, port and transport protocol, plus any SIM/APN settings.
> - How can we confirm that the devices have connected successfully?
>
> Thank you for your support.

## Engineer's reply

> Hi,
>
> We returned to the offices this morning from a company retreat.
>
> We can schedule a call for Wednesday or Thursday.
>
> I will provide a concise answer here, and during our meeting later this week, I can show you the solutions we have and how to implement them to address your questions.
>
> 1. Yes, it's possible, and we support that in the Karma platform and the API response.
>
> In the eData monitor, you just need to activate the Process DTC button, and the error fault codes start to transmit to the server.

The first embedded image follows this instruction in the ODT; see the
[Monitor image analysis](analysis.md#image-1-process-dtcs-in-monitor).

> In the eData protocol, there is a description of the Fault message.

Images 2, 3 and 4 follow this statement and show `418`/`419` fault-message documentation.

> 2. Our support team has already shared all the details about the StarLink Protocol and access.
>
> Please take a look; the email was from 7/10/2026
>
> 3. The StarLink Test server has a different IP and PORT.
>
> With this Test Server, you can fork the device to transmit to your server and our test server.
>
> This will be helpful for testing and developing.

The four referenced images are preserved byte-for-byte under `images/` and displayed
with descriptions in the [analysis](analysis.md#image-1-process-dtcs-in-monitor).
Their archive locations and hashes are recorded in [metadata.json](metadata.json).
