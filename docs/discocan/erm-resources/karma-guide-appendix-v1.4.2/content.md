# Karma User Guide - Appendix for Partners - source content

[Overview and analysis](README.md) · [Image descriptions](images.md) · [Original PDF](source/original.pdf)

Source version: **1.4.2**. Analysis date: **2026-10-16** (Europe/Sofia). Markdown edition: **1.1**. Reference updated: **2026-10-17**.

Page-by-page extraction of the source text, with shaded tables reconstructed as Markdown and original screenshots extracted separately. Repeated running headers and footers are omitted. Symbols and whitespace are normalized; source wording and technical examples are otherwise retained. Page numbers below refer to physical PDF pages, not necessarily the printed footer. Screenshot text is explained in the image catalog; the original PDF retains complete visual context.

**Pages:** [1](#pdf-page-1) · [2](#pdf-page-2) · [3](#pdf-page-3) · [4](#pdf-page-4) · [5](#pdf-page-5) · [6](#pdf-page-6) · [7](#pdf-page-7) · [8](#pdf-page-8) · [9](#pdf-page-9) · [10](#pdf-page-10)

## PDF page 1

[Open original page](source/original.pdf#page=1)

### User Guide Appendix for Partners

Release 1.4.2 \| December 2018 © Copyright 2017 by ERM Advanced Telematics Ltd.

ERM Advanced Telematics 16 Haim Shapira st. Rishon LeZion, 7570418 Israel \| Phone: 972-3-9413313 www.ermtelematics.com \| info@ermtelematics.com

## PDF page 2

[Open original page](source/original.pdf#page=2)

### Table of Contents

1\. Settings and Management for Partners 3

1.1 Create a New Fleet 4

1.2 Add User 4

1.3 Add a Vehicle 6

1.4 Add Driver 7

2\. Adding the possibility to send commands 8

3\. Send commands directly from the Karma to the Device 8

4\. DTC events 9

5\. Support 10

## PDF page 3

[Open original page](source/original.pdf#page=3)

### 1. Settings and Management for Partners

This appendix is a supplement to the Karma Manual. It is intended only for Partners and describes how to configure Karma for your customers.

To setup Karma, go to Settings on the Home Page

and proceed with the following steps:

1\) Create a fleet

2\) Add user

3\) Add vehicle

4\) Add driver

**Images on this page:** [Image 004](images.md#image-004), [Image 005](images.md#image-005), [Image 006](images.md#image-006), [Image 007](images.md#image-007), [Image 008](images.md#image-008).

[Illustrations with their page annotations](images/context-page-003.png).

## PDF page 4

[Open original page](source/original.pdf#page=4)

### 1.1 Create a New Fleet

1\. Go to Settings &gt; Fleets .

2\. Click Add new fleet on the upper left side of the screen.

The following window is displayed.

Name of the fleet

Mail notification template

Date and time formats

Unit converter

3\. Complete all fields, and click Save.

Note: Once you create a new fleet, it cannot be deleted.

### 1.2 Add User

When adding a new user, Karma enables you to define four authorization levels:

- Partner

- Manager

- User

- Viewer

The following table describes the access permissions per account level.

| Role    | Create fleet | Manage fleet | Create users | Manage users | Delete users | Create vehicle | Manage vehicles | Delete vehicles | Create drivers | Manage drivers | Delete drivers | View |
| ------- | ------------ | ------------ | ------------ | ------------ | ------------ | -------------- | --------------- | --------------- | -------------- | -------------- | -------------- | ---- |
| Partner | Yes          | Yes          | Yes          | Yes          | Yes          | Yes            | Yes             | Yes             | Yes            | Yes            | Yes            | Yes  |
| Manager | -            | -            | Yes          | Yes          | Yes          | Yes            | Yes             | Yes             | Yes            | Yes            | Yes            | Yes  |
| User    | -            | -            | -            | -            | -            | -              | Yes             | -               | -              | Yes            | -              | Yes  |
| Viewer  | -            | -            | -            | -            | -            | -              | -               | -               | -              | -              | -              | Yes  |

**Images on this page:** [Image 009](images.md#image-009), [Image 010](images.md#image-010), [Image 011](images.md#image-011).

[Illustrations with their page annotations](images/context-page-004.png).

## PDF page 5

[Open original page](source/original.pdf#page=5)

To add a new user:

1\. Go to Settings &gt; Users .

2\. Click Add new user on the upper left side of the screen.

The following window is displayed.

First and Last Name

Unique User Name and Password to login to Karma

Select User Role

Ascribe User to Fleet

In case of multiple Fleets, select which fleet to refer to, in terms of units’ conversion

3\. Complete all fields, and click Save. You can also edit or delete in the Settings &gt; Users page.

**Images on this page:** [Image 012](images.md#image-012), [Image 013](images.md#image-013), [Image 014](images.md#image-014), [Image 015](images.md#image-015), [Image 016](images.md#image-016), [Image 017](images.md#image-017), [Image 018](images.md#image-018).

[Illustrations with their page annotations](images/context-page-005.png).

## PDF page 6

[Open original page](source/original.pdf#page=6)

### 1.3 Add a Vehicle

1\. Go to Settings &gt; Vehicles.

2\. Click Add new vehicle on the upper left side of the screen.

The following window is displayed.

Once you added new drivers, you can assign vehicles to drivers, and vice versa

The unique StarLink ID is 15 digits, located on the unit’s back under IMEI

Sim Card phone number

Sim Card S/N

3\. Complete all fields, and click Save.

You can also edit and delete vehicle records in the Settings &gt; Vehicles page.

Note: You cannot create a vehicle without a StarLink ID number.

Each ID can be used only once.

**Images on this page:** [Image 019](images.md#image-019), [Image 020](images.md#image-020), [Image 021](images.md#image-021).

[Illustrations with their page annotations](images/context-page-006.png).

## PDF page 7

[Open original page](source/original.pdf#page=7)

### 1.4 Add Driver

1\. Go to Settings &gt; Drivers.

Click Add new driver on the upper left side of the screen.

The following window is displayed.

Driver ID must be unique

Press ‘+’ to add more Phone Numbers

Free text comments

Code to be used when entering a vehicle driven by more than one driver (with Dallas/ KeyPad etc.)

Select Vehicle from the Fleet list * Select more than one if there are multiple vehicles

2\. Complete all fields, and click Save. You can also edit and delete Drivers Records in the Settings &gt; Drivers page.

Note: To assign a driver to a vehicle, or the other way around, both must be assigned to the same fleet.

**Images on this page:** [Image 022](images.md#image-022), [Image 023](images.md#image-023).

[Illustrations with their page annotations](images/context-page-007.png).

## PDF page 8

[Open original page](source/original.pdf#page=8)

### 2. Adding the possibility to send commands

As partner or administrator, a user can permit access to users that are eligible to sending commands.

- Click on "Settings" &gt;&gt;&gt; "Users" &gt;&gt;&gt;

- Once the "Allow Sending Commands" checkbox is checked, clicking on "save" is required to save the changes.

- Once a user is logged in, he is eligible to viewing the vehicle card the commands.

- By clicking on "Read Log", the user can see the commands that were sent to the unit.

Note: It is recommended to grant permission to users that are technically qualify.

### 3. Send commands directly from the Karma to the Device

It is possible to send commands to the StarLink device from the Karma UI

- Go to the Commands area.

- Select the Output.

- By clicking on Set/Reset, the user can activate or deactivate an output.

- For the user's convenience, it is possible to rename each output manually.

- A log table is attached and includes renamed outputs names.

**Images on this page:** [Image 024](images.md#image-024), [Image 025](images.md#image-025), [Image 026](images.md#image-026), [Image 027](images.md#image-027).

## PDF page 9

[Open original page](source/original.pdf#page=9)

- The table contains information from the last 30 days.

### 4. DTC events

- Add DTC (only administrator or partners can add applications to the Karma).

- Setting &gt;&gt;&gt; "APP".

- When DTC option is selected, the user chooses an icon and a designated location to display the icon (it is recommended adding the icon to the vehicles reports).

- The user selects the fleet and the vehicles to apply.

- The user selects the trouble codes expected to be received.

- When DTC report option is clicked,

- A table containing the following fields will appear

o Vehicle o Driver o Distance o Total events o Confirmed trouble codes o Current trouble codes o Permanent trouble code

In case there are faults from the vehicle, the user will be able to see them on the table.

Note: Verify that Parameter 2069 and 2070 have the value 134217731 at StarLink unit.

**Images on this page:** [Image 028](images.md#image-028), [Image 029](images.md#image-029), [Image 030](images.md#image-030).

## PDF page 10

[Open original page](source/original.pdf#page=10)

### 5. Support

Karma is designed especially for you, the service provider. The main purpose is to provide you the most

intuitive, convenient and simple platform that requires minimal support on your end, as a service provider

to your customers and to provide your customers a great experience managing their fleet in a professional,

intuitive and enjoyable way.

For any clarifications, questions or to provide feedback, please contact us at:

Email: support@karma.online

Skype: ERM.Support
