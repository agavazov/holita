# eData Simple - CAN Engine Communication Protocol - source content

[Overview and analysis](README.md) · [Original PDF](source/original.pdf)

Source version: **4.04**. Analysis date: **2026-10-16** (Europe/Sofia). Markdown edition: **1.1**. Reference updated: **2026-10-17**.

Page-by-page extraction of the source text, with shaded tables reconstructed as Markdown. Decorative graphics are omitted; the original PDF preserves the complete visual source. Repeated running headers and footers are omitted. Symbols and whitespace are normalized; source wording and technical examples are otherwise retained. Page numbers below refer to physical PDF pages, not necessarily the printed footer. The original PDF retains complete visual context.

**Pages:** [1](#pdf-page-1) · [2](#pdf-page-2) · [3](#pdf-page-3) · [4](#pdf-page-4) · [5](#pdf-page-5) · [6](#pdf-page-6) · [7](#pdf-page-7) · [8](#pdf-page-8) · [9](#pdf-page-9) · [10](#pdf-page-10) · [11](#pdf-page-11) · [12](#pdf-page-12) · [13](#pdf-page-13) · [14](#pdf-page-14) · [15](#pdf-page-15) · [16](#pdf-page-16) · [17](#pdf-page-17) · [18](#pdf-page-18) · [19](#pdf-page-19) · [20](#pdf-page-20) · [21](#pdf-page-21) · [22](#pdf-page-22) · [23](#pdf-page-23) · [24](#pdf-page-24) · [25](#pdf-page-25) · [26](#pdf-page-26) · [27](#pdf-page-27) · [28](#pdf-page-28) · [29](#pdf-page-29) · [30](#pdf-page-30)

## PDF page 1

[Open original page](source/original.pdf#page=1)

### eData Simple

CAN Engine Communication Protocol

Release 4.04

© Copyright 2022 ERM Electronic Systems Ltd.

ERM Electronic Systems LTD \| www.ermtelematics.com \| support@ermtelematics.com \| +972-3-9413313

## PDF page 2

[Open original page](source/original.pdf#page=2)

Table of Contents

1 GENERAL 3

2 COMMAND STRUCTURE 3

2.1 Sending &amp; receiving multiple parameters, rules and histograms in a message 4

2.2 Updating and deleting parameters, rules and histograms 4

2.3 “301” - Sending Commands to the CAN Engine 5

2.3.1 Sending Parameter Definitions to the CAN Engine 5

2.3.2 Sending Rule Definitions to the CAN Engine 7

2.3.3 Sending Histogram Definitions to the CAN Engine 7

2.3.4 Loading All Parameters from the CAN Engine 8

2.3.5 Loading All Rules from the CAN Engine 8

2.3.6 Loading All Histograms from the CAN Engine 9

2.3.7 Deleting All Parameters from the CAN Engine 9

2.3.8 Deleting All Rules from the CAN Engine 9

2.3.9 Deleting All Histograms from the CAN Engine 9

2.3.10 Loading a Specific Parameter from the CAN Engine 9

2.3.11 Loading a Specific Rule from the CAN Engine 10

2.3.12 Loading a Specific Histogram from the CAN Engine 10

2.3.13 Deleting a Specific Parameter from the CAN Engine 10

2.3.14 Deleting a Specific Rule from the CAN Engine 10

2.3.15 Deleting a Specific Histogram from the CAN Engine 11

2.3.16 Reading errors from the fault logger CAN Engine 11

2.3.17 Deleting errors from the fault logger CAN Engine 11

2.3.18 Deleting fault codes 11

2.3.19 Reading VIN number from the vehicle 11

2.3.20 Set Car-Type 11

2.3.21 Get Car-Type 12

2.3.22 Get Tachograph Driver-ID number from the eData 12

2.4 “302” - Transmitting Global Parameters 12

2.5 "303"-Loading All Global Settings Definitions 14

2.6 "304"-Resetting Global Settings to their Default Values 14

2.7 "306"-Retrieving Diagnostic Data from the Unit 14

2.8 “307” - Activating the Dashboard Mechanism (High Speed Parameter Reporting) 14

2.9 “308” - Loading Version Information from the Unit 15

2.10 “309” - Updating the Unit’s Version 15

2.11 “310” - Enables the transmission of CAN messages on a communication line 15

3 RECEIVING COMMANDS FROM THE UNIT ................................ ................................ ................... 16

3.1 “401” - Loading CAN Engine Parameters from the Unit 16

3.2 “402” - Loading CAN Engine Rules from the Unit 17

3.3 “403” - Loading CAN Engine Histograms from the Unit 17

3.4 "404"- Rule Reporting Structure 18

3.5 “405” - Periodic Parameter Reporting Structure 18

3.6 “406” -Parameter Value Reporting Structure as Result of Rule Occurring 19

3.7 “407”- Parameter Value Reporting Structure, After Ignition Turned Off 19

3.8 “408”- Periodic Reporting Structure of Histogram Values 20

3.9 “409”- Periodic Reporting Structure of Histogram Values after IGN Switched off 21

3.10 “410” - Detailed structure of Global Parameters reports 22

3.11 “411” - Detailed structure of Diagnostic message reports 23

3.12 “412” - Detailed structure of device Hardware 23

3.13 “413” - Detailed Structure of OBD Fault messages 24

3.14 “414” - Detailed structure of VIN Messages 25

3.15 ”415” - Detailed Structure of Parameter Values after the Fault was Received 25

3.16 “416” - Detailed structure of Car-Type Messages 25

3.17 "417” - Detailed Structure of CAN Disconnection 26

## PDF page 3

[Open original page](source/original.pdf#page=3)

3.18 “418” - Detailed Structure of FMS Faults 26

3.19 "419" - Detailed Structure of FMI Fault Messages 26

3.20 ”420” - Detailed Structure of OBD Fault Messages 27

3.21 ”421” - Detailed Structure of an Event when the CAN Goes Back to Sleep 27

3.22 “422” - Detailed structure of HDT Faults 27

3.23 “423” - Detailed structure of Driver-ID’s Messages 28

3.24 Scan FMS Parameters 28

4 ERM CONTACT INFORMATION 29

## PDF page 4

[Open original page](source/original.pdf#page=4)

### 1 General

eData is a dedicated CANBUS interface, able to read/inquire CAN data using various CANBUS protocols. eData is using ERM's CAN Engine technology in order to do that. In eData Simple, CAN Engine comes with predefined and preset protocols and cannot be programmed to additional ones. In order to use additional protocols or customize the eData abilities, the eData Pro firmware needs to be used.

eData Simple supports the following protocols:

- CANBUS: FMS/J1938, CANBUS

- Dynamic OBD: OBD2, VPW, PWM, K-Line

### 2 Command Structure

All the commands sent to and from the CAN Engine component have an almost uniform header that contains flags for parsing the message.

The structure of the message header is as follows:

Device ID - indicates the type of unit (this number is a default value and can be changed)

Separator - “,”

Message type - indicates the type of message

Separator - “,”

Data Format - indicates the format of the message data:

A value of 0 indicates the data is in text format (each character is represented by two bytes of type CHAR ASCII).

A value of 1 indicates the data is in binary format (each character is represented by a single byte).

Separator - “,”

Is Last Message - indicates whether this message is the last message:

A value of 0 indicates this is not the last message, and additional messages are expected.

A value of 1 indicates this is the last message, and no further messages are expected.

Separator - “,”

Message Number - a number indicating the placement of this message within the group of expected messages.

Separator - “,”

Configuration ID - contains the configuration number programmed into the unit, and sent in every message transmitted by the unit. This field does not exist in messages sent to the unit.

## PDF page 5

[Open original page](source/original.pdf#page=5)

Separator - “,”

Message Data

Following is an example of a message sent to the unit:

```text
30,1,19,0,19,,302,0,1,1,03E903E80000090901000101010F00FFFFFFFEFFFFFFFEFFFF8
00008
```

Following is an example of a message sent from the unit:

```text
19,0,407,0,1,1,1001,03E903E80000090901000101010F00FFFFFFFEFFFFFFFEFFFF8000
08
```

### 2.1 Sending &amp; receiving multiple parameters, rules and histograms in a message

When sending or receiving a message to/from the CAN Engine, you can either send/receive a single parameter, rule, or histogram, or you can send/receive multiple parameters, rules and histograms. To indicate this, one byte at the beginning of the message describes the message type, and then we add concatenated same-type structures of parameters, rules, or histograms.

### 2.2 Updating and deleting parameters, rules and histograms

Update command:

Any time an Update command is sent and the parameter, rule or histogram already exist in the unit, their values are updated with the new values sent by the server, and all other definitions remain unchanged. If the parameter, rule or histogram do not exist in the unit, they are added to the list provided the permitted quantity is not exceeded (if there is no room to store them, the unit returns NCK).

Delete and Update command:

Any time a command is sent to delete and update parameters, rules or histograms, the system first deletes everything that already existed, and then updates with the new values. For example, if a delete and update parameters command is sent, the unit deletes all parameters defined in the unit, and saves only the new parameters it receives.

Command-type ID is included in the binary data of the message:

Every command sent to or from the CAN Engine contains the message type in the first bye of the message’s binary data. Commands not intended for the CAN Engine do not contain the message type in the first bye of the message’s binary data.

Message Types:

| Code / field | Description                  |
| ------------ | ---------------------------- |
| 01           | Delete and update parameters |
| 02           | Update parameters            |
| 03           | Delete and update rules      |
| 04           | Update rules                 |
| 05           | Delete and update histograms |
| 06           | Update histograms            |

## PDF page 6

[Open original page](source/original.pdf#page=6)

| Code / field | Description                                                          |
| ------------ | -------------------------------------------------------------------- |
| 07           | Load all parameters stored in the unit                               |
| 08           | Load all rules stored in the unit                                    |
| 09           | Load all histograms stored in the unit                               |
| 0A           | Delete all parameters stored in the unit                             |
| 0B           | Delete all rules stored in the unit                                  |
| 0C           | Delete all histograms stored in the unit                             |
| 0D           | Load a specific parameter                                            |
| 0E           | Load a specific rule                                                 |
| 0F           | Load a specific histogram                                            |
| 10           | Delete a specific parameter stored in the unit                       |
| 11           | Delete a specific rule stored in the unit                            |
| 12           | Delete a specific histogram stored in the unit                       |
| 13           | Report a rule that occurred in the unit                              |
| 14           | Periodic reporting of parameter values                               |
| 15           | Reporting parameters as a result of a rule that occurred in the unit |
| 16           | Reporting parameters after ignition shut off                         |
| 17           | Periodic reporting of histogram values                               |
| 18           | Reporting histograms after ignition shut off                         |
| 30,1,19,0,19 | Error reporting                                                      |
| 1A           | Erase errors                                                         |
| 1B           | Erase diagnostic codes from the vehicle                              |
| 1C           | Send VIN of the vehicle                                              |
| 1D           | Send parameters after an error code occurs                           |
| 20           | Report after an FMS error in the vehicle                             |
| 21           | Report after an FMI error in the vehicle                             |

### 2.3 “301” - Sending Commands to the CAN Engine

All commands sent to the CAN Engine should always have 301 as an ID.

The relevant message type (loading parameters, updating parameters, deleting parameters, etc.) will be included in the command data.

### 2.3.1 Sending Parameter Definitions to the CAN Engine

This section describes the structure of the parameters sent from the server to the CAN Engine for processing.

Example of a command to delete all parameters in the unit and update only two parameters:

```text
30,1,19,0,19,301,0,1,1,01000100000001000800010001FFFF000000000020000A
00020000000200 08000200020002000000000120000A
```

Example of a command for updating a single parameter:

```text
30,1,19,0,19,301,0,1,1,02000100000001000800010001FFFF000000000020000
A
```

Command structure:

## PDF page 7

[Open original page](source/original.pdf#page=7)

| Field Name                   | Size in bytes | Comments                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message Type                 | 1             | 01 = Delete and update parameters 02 = Update parameters                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Parameter ID                 | 2             | Defines the number of the current parameter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Header ID                    | 4             | Defines the ID of the message being broadcast for the current parameter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Start Bit                    | 1             | Defines the start bit position of the relevant data within the message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Bit Count                    | 1             | Defines the number of bits used by the relevant data in the message.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Multiplying                  | 2             | Defines the number with which to multiply the value extracted from data, for the purpose of calculating the true value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Divide                       | 2             | Defines the number with which to divide the value extracted from the data (after multiplying), for the purpose of calculating the true value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Offset                       | 2             | Defines the number to add to the values extracted from the data (after multiplying and dividing), for the purpose of calculating the true value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Filter Mask                  | 2             | Value = Raw-Data &amp; Mask                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Filter Value                 | 2             | The filter value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Type                         | 1             | Defines the type of parameter: 0 - Regular type. 1 - Counter: Counts the number of times the parameter value changes from zero to one. 2 - Difference: The difference between the current value and the previous value (a negative value indicates the parameter decreased, a positive value indicates the parameter increased). 3 - Absolute Difference: The absolute difference between the current value and the previous value. 4 - Accumulated Time: The accumulated time during which the parameter was active (non-zero) during the trip, in milliseconds. 5 - Odometer: For the purpose of updating the StarLink unit with the latest odometer reading received from the vehicle. 6 - Sum: The sum of all values received during the trip. 7 - VSS: A unique parameter for extracting the VSS value from the vehicle. Will always contain the latest VSS value received. 8- DifferenceSum- A parameter that contains the sum value of the parameter differences received during the trip. Speed - Updates the StarLink unit with the vehicle's last odometer value. |
| Parameter Flags              | 1             | The various flags include: Bit 7 - Defines whether the parameter is received from an FMS network. Bit 6 - Defines whether the data is coded in Little-Endian order. Bit 5 - Defines whether to broadcast this parameter using the Dashboard mechanism. Bit 4 - Defines whether the parameter value is non-negative or can be negative. Bit 3 - Defines whether the parameter is reset when the ignition status changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Send Parameter Time Interval | 2             | Defines how often, in seconds, to broadcast this parameter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## PDF page 8

[Open original page](source/original.pdf#page=8)

### 2.3.2 Sending Rule Definitions to the CAN Engine

This section describes the structure of rules sent from the server to the CAN Engine for processing.

Example of a command to delete all the rules in the unit and update only two rules:

```text
30,1,19,0,19,301,0,1,1,0300011AAA1BBB00640707021400010E0000022AA
A2BBB03E8120D0207021400040F1F4009021400040F3A98
```

Example of a command for updating one rule in the unit:

```text
30,1,19,0,19,301,0,1,1,0400011AAA1BBB00640707021400010E00
```

Command structure:

| Field Name                                               | Size in Bytes   | Notes                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message Type                                             | 1               | 03 = Delete and update rules 04 = Update rules                                                                                                                                                                                                                                     |
| Rule ID                                                  | 2               | Defines the number of the current rule.                                                                                                                                                                                                                                            |
| Event ID When Rule Became True                           | 2               | Defines the event ID broadcast to the server when the system determines that the rule conditions are occurring.                                                                                                                                                                    |
| Event ID When Rule Became false                          | 2               | Defines the event ID broadcast to the server when the system determines that the rule conditions stopped occurring.                                                                                                                                                                |
| Debounce Time + Activate Dashboard When Rule Occurs Flag | 2               | Defines the minimum time (in milliseconds) that the rule must occur or stop occurring, for it to be broadcast to the server. The minimum value is 1. The maximum value is 32767 ( 32 seconds) Bit no. 15 determines whether to turn on the dashboard when a rule condition occurs. |
| Rule Data Length                                         | 1               | The length of the rule, in number of bytes.                                                                                                                                                                                                                                        |
| Rule Data                                                | Up to 128 bytes |                                                                                                                                                                                                                                                                                    |

### 2.3.3 Sending Histogram Definitions to the CAN Engine

This section describes the structure of histograms sent from the server to the CAN Engine for processing.

Example of a command to delete all the histograms in the unit and update only two histograms:

```text
30,1,19,0,19,301,0,1,1,0500010005FFFFFE0C000001F403000A020013002A0
0020023FFFFEC78 000013880A00140300180021001B
```

Example of a command for updating one histogram in the unit:

```text
30,1,19,0,19,301,0,1,1,0600010005FFFFFE0C000001F403000A020013002A
```

Command structure:

## PDF page 9

[Open original page](source/original.pdf#page=9)

| Field Name                   | Size in Bytes                                               | Notes                                                                        |
| ---------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Message Type                 | 1                                                           | 05 = Delete and update histograms 06 = Update histograms                     |
| Histogram ID                 | 2                                                           | Defines the number of the current histogram.                                 |
| Main Parameter ID            | 2                                                           | Defines the ID of the parameter on which the histogram is based.             |
| Start Histogram Range        | 4                                                           | Defines the beginning of the histogram range.                                |
| End Histogram Range          | 4                                                           | Defines the end of the histogram range.                                      |
| Total Histogram Columns      | 1                                                           | Defines how to divide the histogram range (number of histogram columns).     |
| Send Histogram Time Interval | 2                                                           | Defines how often, in seconds, the system should broadcast histogram values. |
| Total Related Parameters     | 1                                                           | Defines the number of parameters related to the current histogram.           |
| Related Parameters ID’s List | 2 bytes * the number of parameters related to the histogram | Contains the list of IDs of all related parameters.                          |

### 2.3.4 Loading All Parameters from the CAN Engine

This section describes the structure of the command instructing the CAN Engine to broadcast all the parameters stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0703E8
```

Command structure:

| Field Name       | Size in Bytes | Notes                                        |
| ---------------- | ------------- | -------------------------------------------- |
| Message Type     | 1             | 07 = Load all parameters stored in the unit. |
| Max Message Size | 2             | Defines the maximum message size.            |

### 2.3.5 Loading All Rules from the CAN Engine

This section describes the structure of the command instructing the CAN Engine to broadcast all the rules stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0803E8
```

Command structure:

| Field Name   | Size in Bytes | Notes                                   |
| ------------ | ------------- | --------------------------------------- |
| Message Type | 1             | 08 = Load all rules stored in the unit. |

## PDF page 10

[Open original page](source/original.pdf#page=10)

| Field            | Size / value | Description                       |
| ---------------- | ------------ | --------------------------------- |
| Max Message Size | 2            | Defines the maximum message size. |

### 2.3.6 Loading All Histograms from the CAN Engine

This section describes the structure of the command instructing the CAN Engine to broadcast all the histograms stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0903E8
```

Command structure:

| Field Name       | Size in Bytes | Notes                                        |
| ---------------- | ------------- | -------------------------------------------- |
| Message Type     | 1             | 09 = Load all histograms stored in the unit. |
| Max Message Size | 2             | Defines the maximum message size.            |

### 2.3.7 Deleting All Parameters from the CAN Engine

This section describes the structure of the command instructing the CAN Engine to delete all parameters stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0A
```

### 2.3.8 Deleting All Rules from the CAN Engine

This section describes the structure of the command instructing the CAN Engine to delete all rules stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0B
```

### 2.3.9 Deleting All Histograms from the CAN Engine

This section describes the structure of the command instructing the CAN Engine to delete all histograms stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0C
```

### 2.3.10 Loading a Specific Parameter from the CAN Engine

This section describes the structure of the command used to read a single parameter stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0D0001
```

Command structure:

| Field Name   | Size in Bytes | Notes                                              |
| ------------ | ------------- | -------------------------------------------------- |
| Message Type | 1             | 0D = Load a specific parameter stored in the unit. |

## PDF page 11

[Open original page](source/original.pdf#page=11)

| Field        | Size / value | Description                              |
| ------------ | ------------ | ---------------------------------------- |
| Parameter ID | 2            | Defines the ID of the parameter to load. |

### 2.3.11 Loading a Specific Rule from the CAN Engine

This section describes the structure of the command used to read a single rule stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0E0001
```

Command structure:

| Field Name   | Size in Bytes | Notes                                         |
| ------------ | ------------- | --------------------------------------------- |
| Message Type | 1             | 0E = Load a specific rule stored in the unit. |
| Rule ID      | 2             | Defines the ID of the rule to load.           |

### 2.3.12 Loading a Specific Histogram from the CAN Engine

This section describes the structure of the command used to read a single histogram stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,0F0001
```

Command structure:

| Field Name   | Size in Bytes | Notes                                              |
| ------------ | ------------- | -------------------------------------------------- |
| Message Type | 1             | 0F = Load a specific histogram stored in the unit. |
| Histogram ID | 2             | Defines the ID of the histogram to load.           |

### 2.3.13 Deleting a Specific Parameter from the CAN Engine

This section describes the structure of the command used to delete a single parameter stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,100001
```

Command structure:

| Field Name   | Size in Bytes | Notes                                      |
| ------------ | ------------- | ------------------------------------------ |
| Message Type | 1             | 10 = Delete a specific parameter.          |
| Parameter ID | 2             | Defines the ID of the parameter to delete. |

### 2.3.14 Deleting a Specific Rule from the CAN Engine

This section describes the structure of the command used to delete a single rule stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,110001
```

## PDF page 12

[Open original page](source/original.pdf#page=12)

Command structure:

| Field Name   | Size in Bytes | Notes                                 |
| ------------ | ------------- | ------------------------------------- |
| Message Type | 1             | 11 = Delete a specific rule.          |
| Rule ID      | 2             | Defines the ID of the rule to delete. |

### 2.3.15 Deleting a Specific Histogram from the CAN Engine

This section describes the structure of the command used to delete a single histogram stored in the unit.

Example:

```text
30,1,19,0,19,301,0,1,1,120001
```

Command structure:

| Field Name   | Size in Bytes | Notes                                      |
| ------------ | ------------- | ------------------------------------------ |
| Message Type | 1             | 12 = Delete a specific histogram.          |
| Histogram ID | 2             | Defines the ID of the histogram to delete. |

### 2.3.16 Reading errors from the fault logger CAN Engine

Read the fault codes which are stored at the logger.

Example:

```text
30,1,19,0,19,301,0,1,1, 19
```

### 2.3.17 Deleting errors from the fault logger CAN Engine

Delete all the fault codes stored in the logger.

Example:

```text
30,1,19,0,19,301,0,1,1,1A
```

### 2.3.18 Deleting fault codes

Delete the fault codes stored in the vehicle ECU (sending a unique command to the vehicle).

Example:

```text
30,1,19,0,19,301,0,1,1,1B
```

### 2.3.19 Reading VIN number from the vehicle

Read the value of the VIN number stored in the vehicle.

Example:

```text
30,1,19,0,19,301,0,1,1,1C
```

### 2.3.20 Set Car-Type

Set the value of the car type into eData.

Example:

## PDF page 13

[Open original page](source/original.pdf#page=13)

```text
30,1,19,0,301,0,1,1,1E0002
```

None: For the updated vehicle list please contact our support

### 2.3.21 Get Car-Type

Read the value of the car type configured in eData.

Example:

```text
30,1,19,0,301,0,1,1,1F
```

### 2.3.22 Get Tachograph Driver-ID number from the eData

Read the value of the driver id’s stored in the eData.

Example:

```text
30,1,19,0,301,0,1,1,23
```

### 2.4 “302” - Transmitting Global Parameters

This section describes the command used to set the Global settings of the unit.

Example:

```text
30,1,19,0,19,302,0,1,1,03E903E8000009090101000000010F00130118000303011122
33445566778899A A
```

Command structure:

| Field Name                     | Size in Bytes | Notes                                                                                                                                                   |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration ID               | 2             | Specifies the ID of the configuration stored in the unit.                                                                                               |
| Message Max Size               | 2             | Specifies the maximum size of the message in terms of the number of bytes.                                                                              |
| Debounce Time for Ignition On  | 1             | Specifies the stabilization time in seconds of the ignition state when the ignition is turned on.                                                       |
| Debounce Time for Ignition Off | 1             | Specifies the stabilization time in seconds of the ignition state when the ignition is turned off.                                                      |
| CANBUS # 1 Baud Rate           | 1             | Specifies the Baud Rate of CANBUS # 1: • 0 = 10K • 1 = 20K • 2 = 33.333K • 3 = 50K • 4 = 62.5K • 5 = 8 3.333K • 6 = 100K • 7 = 125K • 8 = 250K 9 = 500K |
| Process CANBUS while           | 1             | • 1 = Check and process CAN + RULES messages when the ignition is off. 0 = No processing when the ignition is off.                                      |

## PDF page 14

[Open original page](source/original.pdf#page=14)

| Field                              | Size / value | Description                                                                                                                                                                                               |
| ---------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ignition state is Off              |              |                                                                                                                                                                                                           |
| Send Parameters at Trip End        | 1            | 1. Determines whether to send all parameters at the end of the trip.                                                                                                                                      |
| Send Histograms at Trip End        | 1            | 2. Determines whether to send all histograms at the end of the trip.                                                                                                                                      |
| Send Data Binary                   | 1            | Determines the transmission format of the data: • 0 - Text 3. 1 - Binary                                                                                                                                  |
| CANBUS # 1 In Silent Mode          | 1            | Determines whether CANBUS # 1 works in silent mode or in Send Acknowledge working mode: • 0 - CANBUS sends acknowledgements 1 - CANBUS does not send acknowledgements                                     |
| CANBUS # 2 In Silent Mode          | 1            | Specifies whether CANBUS # 2 works in silent working mode or in Send Acknowledge working mode: • 0 - CANBUS sends acknowledgements 1 - CANBUS does not send acknowledgements                              |
| OBD Unit                           | 1            | Determines whether the unit processes the OBD protocol: • 0 - Do not process the OBD protocol 1 - Process the OBD protocol                                                                                |
| OBD Protocols Bit Mask             | 1            | Defines which OBD-type protocols the unit should try to process: • Bit 1 - Process OBD CANBUS • Bit 2 - Process OBD VPW • Bit 3 - Process OBD PWM Bit 4 - Process OBD KLINE                               |
| Regular Protocols Bit Mask         | 1            | Defines which regular protocols the unit should try to process: • Bit 1 - Process Regular CANBUS Bit 2 - Process J1708                                                                                    |
| Device ID                          | 1            | The ID of the product. (You can connect several units on the sale line) • Minimum value - 1 Maximum value - 255                                                                                           |
| Report Parameters When Rule Occurs | 1            | Determines whether the system broadcasts all CAN Engine parameters before broadcasting the rule itself. • 0 - Does not broadcast parameters before the rule 1 - Does broadcast parameters before the rule |
| Process FMS DTCs                   | 1            | If active, the system queries faults from the FMS.                                                                                                                                                        |
| Send Odometer Options              | 1            | Determines the reporting type for the Odometer variable: • 1 km • 100 m • 10 m • 1m • 1 km per trip, • 100 m per trip, • 10 m per trip, 1m per trip                                                       |
| Debounce Count to Accept DTC       | 1            | Determines the minimum number of times a vehicle must receive a fault before reporting a new fault. The value must be ≥ 1.                                                                                |

## PDF page 15

[Open original page](source/original.pdf#page=15)

| Field                                    | Size / value | Description                                                                                                                                                                                                       |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Debounce Count to Decline DTC            | 1            | Determines the minimum number of times a problem should stop in a vehicle before a fault has been reported from the vehicle (a value must be greater than or equal to 2)                                          |
| Report Parameters When Fault Code Occurs | 1            | Determines whether the system transmits all CAN Engine parameters before the fault code is transmitted. • 0 - Not active 1 - Active                                                                               |
| Fault Codes to Ignore Array              | 2*5          | A list of fault codes which the system should ignore. There is a maximum of five fault codes to ignore. 2 bytes are used for each fault code. Once a fault code appears in the above list, the system ignores it. |

### 2.5 "303"-Loading All Global Settings Definitions

This section describes the structure of the command used to upload from the unit the definitions of all the Global Settings.

Example:

```text
30,1,19,0,19,303,0,1,1,
```

### 2.6 "304"-Resetting Global Settings to their Default Values

This section describes the structure of the command used to set all Global Settings to their default values.

Example:

```text
30,1,19,0,19,304,0,1,1,
```

"305"-Resetting the Unit

This section describes the structure of the command used to reset the unit.

Example:

```text
30,1,19,0,19,305,0,1,1,
```

### 2.7 "306"-Retrieving Diagnostic Data from the Unit

This section describes the structure of the command used to query the unit regarding the types of communications identified by the unit - including the identification of errors on the CAN bus.

Example:

```text
30,1,19,0,19,306,0,1,1,
```

### 2.8 “307” - Activating the Dashboard Mechanism (High Speed Parameter Reporting)

This section describes the command used to instruct the unit to start broadcasting dashboard-type parameters at the time intervals defined in the command.

Example:

```text
30,1,19,0,19,307,0,1,1,012C000A
```

## PDF page 16

[Open original page](source/original.pdf#page=16)

Command structure:

| Field Name           | Size in Bytes | Notes                                                                                       |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| Total Dashboard Time | 2             | Specifies the total time duration, in seconds, when the Dashboard mechanism will be active. |
| Time Interval        | 2             | Specifies the time intervals between dashboard messages broadcasts.                         |

### 2.9 “308” - Loading Version Information from the Unit

This section describes the command used to query the unit regarding its software version and hardware version.

Example:

```text
30,1,19,0,19,308,0,1,1,
```

### 2.10 “309” - Updating the Unit’s Version

This section describes the command used to operate the version upgrade mechanism within the unit.

Example:

```text
30,1,19,0,19,309,0,1,1,
```

### 2.11 “310” - Enables the transmission of CAN messages on a communication line

When the unit receives this command, it starts broadcasting the command information sent to the vehicle's communication line (CAN).

Example:

```text
30,1,19,0,19,310,0,1,1,0100001234081020304050607080000A000A50
```

| Field Name            | Example value | Size in Bytes | Notes                                                                                 |
| --------------------- | ------------- | ------------- | ------------------------------------------------------------------------------------- |
| CAN Type              | 01            | 1             | Specifies the type of message HEADER ID. • 0 - Standard 11 Bit. • 1 - Extended 29 Bit |
| Header ID             | 00001234      | 4             | Sets the HEADER ID to be broadcast on the line                                        |
| Message Data Length   | 08            | 1             | The length of the message (1-8)                                                       |
| Message Data Byte # 1 | 10            | 1             | The value of Byte number 1 in the message.                                            |
| Message Data Byte # 2 | 20            | 1             | The value of Byte number 2 in the message.                                            |
| Message Data Byte # 3 | 30            | 1             | The value of Byte number 3 in the message.                                            |

## PDF page 17

[Open original page](source/original.pdf#page=17)

| Data / field           | Field / value | Size / value | Notes                                                                                                                                 |
| ---------------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Message Data Byte # 4  | 40            | 1            | The value of Byte number 4 in the message.                                                                                            |
| Message Data Byte # 5  | 50            | 1            | The value of Byte number 5 in the message.                                                                                            |
| Message Data Byte # 6  | 60            | 1            | The value of Byte number 6 in the message.                                                                                            |
| Message Data Byte # 7  | 70            | 1            | The value of Byte number 7 in the message.                                                                                            |
| Message Data Byte # 8  | 80            | 1            | The value of Byte number 8 in the message.                                                                                            |
| Total Retries          | 000A          | 2            | The number of times the unit transmits the message.                                                                                   |
| Time Interval          | 000A          | 2            | The time interval between transmissions in milliseconds.                                                                              |
| Message Validation XOR | 50            | 1            | The XOR value of all fields (bytes) of the message (for validation purposes) The initial value from which the XOR must be sum is 0xFF |

### 3 Receiving Commands from the Unit

### 3.1 “401” - Loading CAN Engine Parameters from the Unit

This section describes the format of the data arriving from the unit in response to a request for loading a specific parameter or several parameters from the unit.

Example of one parameter f received from the unit:

```text
19,0,401,0,1,1,1001,07000180BD000100080001000100000100010000F0003C
```

Example of two parameters received from the unit:

```text
19,0,401,0,1,1,1001,07000180BD000100080001000100000100010000F0003C0
002880004E800100 002000AFFCE1001100101A00078
```

Data structure:

| Field Name   | Size in Bytes | Notes                                       |
| ------------ | ------------- | ------------------------------------------- |
| Message Type | 1             | 07 - Loading parameters stored in the unit. |

| Code / field | Description |
| ------------ | ----------- |
| Parameter ID | 2           |
| Header ID    | 4           |
| Start Bit    | 1           |
| Bit Count    | 1           |
| Multiplying  | 2           |
| Divide       | 2           |

## PDF page 18

[Open original page](source/original.pdf#page=18)

| Code / field                 | Description |
| ---------------------------- | ----------- |
| Offset                       | 2           |
| Filter Mask                  | 2           |
| Filter Value                 | 2           |
| Type                         | 1           |
| Parameter Flags              | 1           |
| Send Parameter Time Interval | 2           |

### 3.2 “402” - Loading CAN Engine Rules from the Unit

This section describes the format of the data arriving from the unit in response to a request for loading a specific rule or several rules from the unit.

Example of one rule received from the unit:

```text
19,0,402,0,1,1,1001,0800011AAA1BBB00640707021400010E00
```

Example of two rules received from the unit:

```text
19,0,402,0,1,1,1001,0800011AAA1BBB00640707021400010E0000022AAA2BBB
03E8120D020702 1400040F1F4009021400040F3A98
```

Data structure:

| Field Name   | Size in Bytes | Notes                                  |
| ------------ | ------------- | -------------------------------------- |
| Message Type | 1             | 08 - Loading rules stored in the unit. |

| Code / field                    | Description     |
| ------------------------------- | --------------- |
| Rule ID                         | 2               |
| Event ID When Rule Became True  | 2               |
| Event ID When Rule Became false | 2               |
| Debounce Time                   | 2               |
| Rule Data Length                | 1               |
| Rule Data                       | Up to 128 bytes |

### 3.3 “403” - Loading CAN Engine Histograms from the Unit

This section describes the format of the data arriving from the unit in response to a request for loading a specific histogram or several histograms from the unit.

Example of one histogram received from the unit:

```text
19,0,403,0,1,1,1001,0900010001FFFFFFFF00000001030001010001
```

Example of two histograms received from the unit:

```text
19,0,403,0,1,1,1001,0900010001FFFFFFFF0000000103000101000100020002FF
FFFFFE0000000 20300010200020003
```

Data structure:

## PDF page 19

[Open original page](source/original.pdf#page=19)

| Field Name   | Size in Bytes | Notes                                       |
| ------------ | ------------- | ------------------------------------------- |
| Message Type | 1             | 09 - Loading histograms stored in the unit. |

| Code / field                 | Description                                                 |
| ---------------------------- | ----------------------------------------------------------- |
| Histogram ID                 | 2                                                           |
| Main Parameter ID            | 2                                                           |
| Start Histogram Range        | 4                                                           |
| End Histogram Range          | 4                                                           |
| Total Histogram Columns      | 1                                                           |
| Send Histogram Time Interval | 2                                                           |
| Total Related Parameters     | 1                                                           |
| Related Parameters ID’s List | 2 bytes * the number of parameters related to the histogram |

### 3.4 "404"- Rule Reporting Structure

This section describes the format of the data arriving from the unit as a result of a certain rule occurring in the unit.

Example of one occurring rule received from the unit:

```text
19,0,404,0,1,1,1001,1300011AAA000000000001
```

Example of two occurring rules received from the unit:

```text
19,0,404,0,1,1,1001,1300011AAA00000000000100021BBB000000000001
```

Data structure:

| Field Name   | Size in Bytes | Notes                                                      |
| ------------ | ------------- | ---------------------------------------------------------- |
| Message Type | 1             | 13 - Reporting a rule that occurred in the unit.           |
| Rule ID      | 2             | The ID of the rule that occurred in the unit.              |
| Event ID     | 2             | The ID of the event that occurred in the unit.             |
| Rule Time    | 4             | Defines the total duration, in milliseconds, of the event. |
| Total Count  | 2             | Defines the number of times the event occurred.            |

### 3.5 “405” - Periodic Parameter Reporting Structure

This section describes the data format of the values of parameters defined in the unit to be reported periodically.

Example of reporting the value of a single parameter:

```text
19,0,405,0,1,1,1001,140001000155
```

Example of reporting the value of two parameters:

```text
19,0,405,0,1,1,1001,140001000155000201021234
```

## PDF page 20

[Open original page](source/original.pdf#page=20)

Data structure:

| Field Name           | Size in Bytes                                  | Notes                                                                                   |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Message Type         | 1                                              | 14 - Periodic reporting of parameter values.                                            |
| Parameter ID         | 2                                              | The ID of the reported parameter.                                                       |
| Parameter Type       | 1                                              | The type of reported parameter.                                                         |
| Parameter Value Size | 1                                              | Defines the length, in bytes, of the value of the reported parameter (1, 2 or 4 bytes). |
| Parameter Value      | According to the value in Parameter Value Size | The most recent reading of the parameter value in the unit.                             |

### 3.6 “406” -Parameter Value Reporting Structure as Result of Rule Occurring

This section describes the data format of values of parameters defined in the unit and reported as the result of a rule occurring.

Note that first the parameters are reported and then the rule is reported.

Example of reporting the value of a single parameter:

```text
19,0,406,0,1,1,1001,150001000155
```

Example of reporting the values of two parameters:

```text
19,0,406,0,1,1,1001,150001000155000201021234
```

Data structure:

| Field Name           | Size in Bytes                                  | Notes                                                                                   |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Message Type         | 1                                              | 15 - Reporting parameter values as the result of a rule occurring in the unit.          |
| Parameter ID         | 2                                              | The ID of the reported parameter.                                                       |
| Parameter Type       | 1                                              | The type of reported parameter.                                                         |
| Parameter Value Size | 1                                              | Defines the length, in bytes, of the value of the reported parameter (1, 2 or 4 bytes). |
| Parameter Value      | According to the value in Parameter Value Size | The most recent reading of the parameter value in the unit.                             |

### 3.7 “407”- Parameter Value Reporting Structure, After Ignition Turned Off

This section describes the data format of values of parameters defined in the unit and reported after ignition turned off (at end of trip).

Example of reporting the value of a single parameter:

```text
19,0,407,0,1,1,1001,160001000155
```

## PDF page 21

[Open original page](source/original.pdf#page=21)

Example of reporting the values of two parameters:

```text
19,0,407,0,1,1,1001,160001000155000201021234
```

Data structure:

| Field Name           | Size in Bytes                                  | Notes                                                                                   |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Message Type         | 1                                              | 16 - Reporting parameter values after ignition turned off.                              |
| Parameter ID         | 2                                              | The ID of the reported parameter.                                                       |
| Parameter Type       | 1                                              | The type of reported parameter.                                                         |
| Parameter Value Size | 1                                              | Defines the length, in bytes, of the value of the reported parameter (1, 2 or 4 bytes). |
| Parameter Value      | According to the value in Parameter Value Size | The most recent reading of the parameter value in the unit.                             |

### 3.8 “408”- Periodic Reporting Structure of Histogram Values

This section describes the data format of values of histograms defined in the unit and reported periodically.

Example of reporting the value of a single histogram consisting of three columns and two related parameters:

```text
19,0,408,0,1,1,1001,17000103020002000300000185FFFFFCF6FFFFFB71000001
8500000000000 00000000001850000030A0000048F
```

Example of reporting the values of two histograms, each of which consists of three columns and two related parameters:

```text
19,0,408,0,1,1,1001,17000103020002000300000920FFFFEDC0FFFFE4A000000
9200000000000000000000009200000124000001B6000020302000500060000
092000002DA0000036C000000920F
FFFD260FFFFC940000009200000000000000000
```

Data structure:

| Field Name                   | Size in Bytes                                                                     | Notes                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Message Type                 | 1                                                                                 | 17 - Periodic reporting of histogram values.                           |
| Histogram ID                 | 2                                                                                 | The ID of the reported histogram.                                      |
| Total Columns                | 1                                                                                 | The number of columns in the reported histogram.                       |
| Total Related Parameters     | 1                                                                                 | The number of parameters related to the histogram.                     |
| Related Parameters Id’s List | 2 bytes per each parameter ID * the number of parameters related to the histogram | The list of parameter IDs for the parameters related to the histogram. |

## PDF page 22

[Open original page](source/original.pdf#page=22)

| Field                                      | Size / value                                                                   | Description                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Column Total Count                         | 4                                                                              | The number of times the value of the histogram’s main parameter was within the range of the column. Note: This field is sent for each column defined in the histogram.                                              |
| Total Related Parameters * Parameter Value | 4 bytes for each parameter * the number of parameters related to the histogram | For each parameter defined for the histogram - the sum of parameter values in this column. If no parameters are defined, this field is not sent. Note: This field is sent for each column defined in the histogram. |

Both fields marked with bold are repeated according to the number of columns defined in the histogram.

### 3.9 “409”- Periodic Reporting Structure of Histogram Values after IGN Switched off

This section describes the data format for histogram values defined in the unit and reported periodically.

Example #1: Reporting the value of a single histogram consisting of three columns and two related parameters:

```text
19,0,409,0,1,1,1001,18000103020002000300000185FFFFFCF6FFFFFB71000001
8500000000000 00000000001850000030A0000048F
```

Example #2: Reporting the values of two histograms, each of which consists of three columns and two related parameters:

```text
19,0,409,0,1,1,1001,18000103020002000300000920FFFFEDC0FFFFE4A000000
9200000000000000000000009200000124000001B6000020302000500060000
092000002DA0000036C000000920F
FFFD260FFFFC940000009200000000000000000
```

Data structure:

| Field Name                 | Size in Bytes                                                                     | Notes                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Message Type               | 1                                                                                 | 18 - Periodic reporting of histogram values after the IGN is switched off.                                             |
| Histogram ID               | 2                                                                                 | The ID of the reported histogram.                                                                                      |
| Total Columns              | 1                                                                                 | The number of columns in the reported histogram.                                                                       |
| Total Related Parameters   | 1                                                                                 | The number of parameters related to the histogram.                                                                     |
| Related Parameters ID List | 2 bytes per each parameter ID * the number of parameters related to the histogram | The list of parameter IDs for the parameters related to the histogram.                                                 |
| Column Total Count         | 4                                                                                 | The number of times the value of the histogram’s main parameter was within the range of a particular histogram column. |

## PDF page 23

[Open original page](source/original.pdf#page=23)

| Field                                      | Size / value                                                                   | Description                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Total Related Parameters * Parameter Value | 4 bytes for each parameter * the number of parameters related to the histogram | The sum of all parameter values defined for the histogram. If no parameters are defined, this field is not sent. |

Both fields marked with bold are repeated according to the number of columns defined in the histogram.

### 3.10 “410” - Detailed structure of Global Parameters reports

This section describes the settings and structure arriving from the unit for each global parameter.

Example of an entire row as shown on the server:

```text
19,0,410,0,1,1,1001,03E903E8000009090101000000010F00130118000303011
122334455667788 99AA
```

Data structure:

| Data (HEX) | Field Name                         | Size in Bytes ( byte = 2 characters/digits) |
| ---------- | ---------------------------------- | ------------------------------------------- |
| 03E9       | Configuration ID                   | 2                                           |
| 03E8       | Message Max Size                   | 2                                           |
| 00         | Debounce Time For Ignition On      | 1                                           |
| 00         | Debounce Time For Ignition Off     | 1                                           |
| 09         | CANBUS # Baud Rate                 | 1                                           |
| 09         | CANBUS # 2 Baud Rate               | 1                                           |
| 01         | Send Parameters In Trip End        | 1                                           |
| 01         | Send Histograms In Trip End        | 1                                           |
| 00         | Send Data Binary                   | 1                                           |
| 00         | CANBUS # 1 In Silent Mode          | 1                                           |
| 00         | CANBUS # 2 In Silent Mode          | 1                                           |
| 01         | OBD Unit                           | 1                                           |
| 0F         | OBD Protocols Bit Mask             | 1                                           |
| 00         | Regular Protocols Bit Mask         | 1                                           |
| 13         | Device ID                          | 1                                           |
| 01         | Report Parameters When Rule Occurs | 1                                           |
| 18         | Keep Alive Message Time Interval   | 1                                           |
| 00         | Send Odometer Options              | 1                                           |

## PDF page 24

[Open original page](source/original.pdf#page=24)

| Field                | Size / value                             | Description |
| -------------------- | ---------------------------------------- | ----------- |
| 03                   | Debounce Count To Accept DTC             | 1           |
| 03                   | Debounce Count To Decline DTC            | 1           |
| 01                   | Report Parameters When Fault Code Occurs | 1           |
| 112233445566778899AA | Fault Codes To Ignore Array              | 2*5         |

### 3.11 “411” - Detailed structure of Diagnostic message reports

This section describes the settings and structure arriving from the unit for Diagnostic message.

Example of an entire row as shown on the server:

```text
19,0,411,0,1,1,1001,05010101
```

Data structure:

| Data (HEX) | Field Name | Size in Bytes (byte = 2 characters/digits) | Notes |
| ---------- | ---------- | ------------------------------------------ | ----- |

| Field | Size / value                    | Description |
| ----- | ------------------------------- | ----------- |
| 05    | Last Communication Bit Mask     | 1           |
| 01    | Last OBD Communication Bit Mask | 1           |
| 01    | Have CANBUS Errors              | 1           |
| 01    | Ignition State                  | 1           |

Bit 0 → CANBUS Communication

Bit 1 → j1708 Communication

Bit 2 → OBD Communication

Bit 0 → OBD CANBUS 1

Bit 1 → OBD Kline

1 = Error Online

0 = No Error Online

Ignition Is Off = 0

Ignition Is On = 1

Ignition State Is Unknown = 2

### 3.12 “412” - Detailed structure of device Hardware

This section describes the settings and structure arriving from the unit for device Hardware.

Example of an entire row as shown on the server:

```text
19,0,412,0,1,1,1001,0417010209
```

Data structure:

| Data (HEX) | Field Name | Size in Bytes (byte = 2 characters/digits) | Notes |
| ---------- | ---------- | ------------------------------------------ | ----- |

## PDF page 25

[Open original page](source/original.pdf#page=25)

| Data / field                                  | Field / value          | Size / value | Notes                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04                                            | Software Major Version | 1            |                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 17                                            | Software Minor Version | 1            |                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 01                                            | Hardware Major Version | 1            |                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 02                                            | Hardware Minor Version | 1            |                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 09 (01=Hardware in BitMask + 08=Simple eData) | Hardware Type          | 1            | Idata1E2 Hardware = 1 CANG1E3 Hardware = 2 Simple_eData Hardware = 3 u8 Get_Device_Details_BitMask(void) { u8 Result_BitMask = 0; #ifdef IDATA1E2 Result_BitMask \|= (1 &lt;&lt; 0); #endif #ifdef CANG1E3 Result_BitMask \|= (1 &lt;&lt; 1); #endif #ifdef PROFFESIONAL_IDATA Result_BitMask \|= (1 &lt;&lt; 2); #endif #ifdef SIMPLE_IDATA Result_BitMask \|= (1 &lt;&lt; 3); #endif return Result_BitMask; } |

### 3.13 “413” - Detailed Structure of OBD Fault messages

Detail data format of the message containing the faults received from the vehicle (OBD module).

Example of 3 faults as shown on the server:

```text
19,0,413,0,1,1,1001,19111101622202B33301
```

Fault no.1 the code received 1111, original fault code P1111

Fault no.1 the code received 6222, original fault code C2222

Fault no.1 the code received B333, original fault code B3333

Data structure:

| Field Name         | Size in Bytes (byte = 2 characters/digits) | Notes                                                                                                        |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Message Type       | 1                                          | 19 - Error report                                                                                            |
| Fault Code Real ID | 2                                          | ID of the reported fault                                                                                     |
| Fault Code Status  | 1                                          | Status of the reported fault 01 - The fault is added to the logger 02= the fault was deleted from the logger |

## PDF page 26

[Open original page](source/original.pdf#page=26)

### 3.14 “414” - Detailed structure of VIN Messages

Detail the data format of the message containing the VIN number (Vehicle number)

Example:

```text
19,0,414,0,1,1,1001,1C3031323334353637383941424344454647
```

Data structure:

| Field Name   | Size in Bytes (byte = 2 characters/digits) | Notes                 |
| ------------ | ------------------------------------------ | --------------------- |
| Message Type | 1                                          | C1= Report of the VIN |
| VIN Number   | 17                                         | VIN                   |

### 3.15 ”415” - Detailed Structure of Parameter Values after the Fault was Received

Structure of reporting parameter values after a fault received in the vehicle.

Example of 1 parameter sent to the server:

```text
19,0,415,0,1,1,1001,1D0001000155
```

Example of 2 parameters sent to the server:

```text
19,0,415,0,1,1,1001,1D0001000155000201021234
```

Data structure:

| Field Name           | Size in Bytes (byte = 2 characters/digits) | Notes                                |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| Message Type         | 1                                          | 1D - FMS error report                |
| Parameter ID         | 2                                          | The reported parameter ID            |
| Parameter Type       | 1                                          | The type of reported parameter       |
| Parameter Value Size | 1                                          | Sets the reported bit length (1,2,4) |
| Parameter Value      | 1                                          | The last value the unit received     |

### 3.16 “416” - Detailed structure of Car-Type Messages

Detail the data format of the message containing the Car-Type

Example:

```text
19,0,416,0,1,1,1001,1F0002
```

Data structure:

## PDF page 27

[Open original page](source/original.pdf#page=27)

| Field Name             | Size in Bytes (byte = 2 characters/digits) | Notes |
| ---------------------- | ------------------------------------------ | ----- |
| Message Type           | 1                                          |       |
| Report of the Car-Type | 1F                                         |       |
| Car-Type               | 2                                          | 0002  |

### 3.17 "417” - Detailed Structure of CAN Disconnection

This event is reported from the unit when the ignition switch is active (IGN ON) and no messages are received for the CAN for 500 milliseconds.

Example of a fault on the server:

```text
19,0,417,0,1,1,1001,
```

### 3.18 “418” - Detailed Structure of FMS Faults

Detail the data format of the message containing the faults received from the vehicle (FMS module)

Example of 3 faults as shown on the server:

```text
19,0,418,0,1,1,1001,20804952565601854849484802
```

Fault no. P1482 was added

Fault no. U0100 was deleted

Data structure:

| Field Name        | Size in Bytes (byte = 2 characters/digits) | Notes                                                                                                                   |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Message Type      | 1                                          | 20 = FMS error report                                                                                                   |
| Fault Code ID     | 5                                          | 5 ASCII characters for the received fault                                                                               |
| Fault Code Status | 1                                          | The status of the reported fault: • 01 - The fault was added to the logger • 02 - The fault was deleted from the logger |

### 3.19 "419" - Detailed Structure of FMI Fault Messages

Detail the data format of the message containing the faults received from the vehicle (FMI)

Example of 3 faults on the server:

```text
19,0,419,0,1,1,1001,210000A5A605010000B1230402
```

Fault no.1 the value SPN = 0000A5A6, and the value FMI = 05 were added

Fault no.2 the value SPN = 0000B123, and FMI = 04 were deleted

## PDF page 28

[Open original page](source/original.pdf#page=28)

Data structure:

| Field Name        | Size in Bytes (byte = 2 characters/digits) | Notes                                                                                                                   |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Message Type      | 1                                          | 21 - FMS error report                                                                                                   |
| Fault Code SPN    | 1                                          | The SPN value of the fault (19 bit) The maximum value is 524,287.                                                       |
| Fault Code FMI    | 1                                          | The FMI value of the fault (5 bit) The maximum value is 31.                                                             |
| Fault Code Status | 1                                          | The status of the reported fault: • 01 - The fault was added to the logger • 02 - The fault was deleted from the logger |

### 3.20 ”420” - Detailed Structure of OBD Fault Messages

The unit reports this event when the ignition switch is off (IGN OFF) and a message is received on the CAN.

Example of a fault as shown on the server:

```text
19,0,420,0,1,1,1001,
```

### 3.21 ”421” - Detailed Structure of an Event when the CAN Goes Back to Sleep

The unit reports this event when the CAN is woken up when the IGN is switched off and the CAN goes back to sleep.

Example of a fault on the server:

```text
19,0,421,0,1,1,1001
```

### 3.22 “422” - Detailed structure of HDT Faults

Detail the data format of the message containing the faults received from HDT vehicle (Mercedes truck)

Example:

```text
19,0,422,0,1,1,1001,22000601
```

Data structure:

| Field Name    | Size in Bytes (byte = 2 characters/digits) | Notes                        |
| ------------- | ------------------------------------------ | ---------------------------- |
| Message Type  | 1                                          | 22 = Report of the HDT Fault |
| Fault Code ID | 2                                          |                              |

## PDF page 29

[Open original page](source/original.pdf#page=29)

| Field             | Size / value | Description                                                                                                             |
| ----------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Fault Code Status | 1            | The status of the reported fault: • 01 - The fault was added to the logger • 02 - The fault was deleted from the logger |

### 3.23 “423” - Detailed structure of Driver-ID’s Messages

Detail the data format of the message containing the 2 Driver-ID’s

Example:

```text
19,0,423,0,1,1,1001,2330313233343536373839414243444546
```

Data structure:

| Field Name   | Size in Bytes (byte = 2 characters/digits) | Notes                                                                                                                             |
| ------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Message Type | 1                                          | 23 = Report of the Driver-ID                                                                                                      |
| Driver-ID    | 16                                         | support 2 driver-id’s , 8 bytes each ID 1st ID 3031323334353637 2nd ID 3839414243444546 When no driver ID exist, eData send zeros |

### 3.24 Scan FMS Parameters

Send command to eData to start FMS auto search parameters. (active in FMS version only)

Example:

```text
30,1,19,0,312,0,1,1
```

“424” - Detailed structure of Scan FMS Finished Messages

Detail the data format of the message containing the number of parameters found during FMS scanning

Example:

```text
19,0,424,0,1,1,1001,240055
```

Data structure:

| Field Name       | Size in Bytes (byte = 2 characters/digits) | Notes                                   |
| ---------------- | ------------------------------------------ | --------------------------------------- |
| Message Type     | 1                                          | 24 = Report of the Scan finished result |
| Parameters Found | 2                                          |                                         |

## PDF page 30

[Open original page](source/original.pdf#page=30)

### 4 ERM Contact Information

ERM Support:

Skype: erm.support

StarLink online protocol site: http://erm.co.il/protocol

ERM’s YouTube Channel: http://www.youtube.com/ermtelematics

ERM Advanced Telematics

16 Hasar Shapira Street, Rishon Lezion, 7570418, Israel

Telephone: +972-(0)3-941-3313, Fax: +972-(0)3-941-3330

Web: www.ermtelematics.com
