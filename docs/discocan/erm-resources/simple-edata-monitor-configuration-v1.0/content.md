# Simple eData Monitor Configuration Guide - source content

[Overview and analysis](README.md) · [Image descriptions](images.md) · [Original PDF](source/original.pdf)

Source version: **1.0**. Analysis date: **2026-10-16** (Europe/Sofia). Markdown edition: **1.1**. Reference updated: **2026-10-17**.

Page-by-page extraction of the source text, with shaded tables reconstructed as Markdown and original screenshots extracted separately. Repeated running headers and footers are omitted. Symbols and whitespace are normalized; source wording and technical examples are otherwise retained. Page numbers below refer to physical PDF pages, not necessarily the printed footer. Screenshot text is explained in the image catalog; the original PDF retains complete visual context.

**Pages:** [1](#pdf-page-1) · [2](#pdf-page-2) · [3](#pdf-page-3) · [4](#pdf-page-4) · [5](#pdf-page-5) · [6](#pdf-page-6) · [7](#pdf-page-7) · [8](#pdf-page-8) · [9](#pdf-page-9) · [10](#pdf-page-10) · [11](#pdf-page-11) · [12](#pdf-page-12) · [13](#pdf-page-13) · [14](#pdf-page-14) · [15](#pdf-page-15) · [16](#pdf-page-16) · [17](#pdf-page-17) · [18](#pdf-page-18) · [19](#pdf-page-19) · [20](#pdf-page-20) · [21](#pdf-page-21) · [22](#pdf-page-22) · [23](#pdf-page-23) · [24](#pdf-page-24) · [25](#pdf-page-25) · [26](#pdf-page-26) · [27](#pdf-page-27) · [28](#pdf-page-28)

## PDF page 1

[Open original page](source/original.pdf#page=1)

### Simple eData Monitor

### Configuration Guide

Release 1.0

© Copyright 2017 by ERM Electronic Systems Ltd.

ERM Electronic Systems LTD 16 Haim Shapira st. Rishon LeZion, 75704 Israel \| Phone: 972-3-9413313 Fax: 972-3-9413330

www.ermtelematics.com \| info@erm.co.il

**Images on this page:** [Image 002](images.md#image-002).

## PDF page 2

[Open original page](source/original.pdf#page=2)

### Table of Contents

1\. Overview of Simple eData ..................................................................................................... 3

2\. Installing Simple eData in a Vehicle ...................................................................................... 4

4-Pin Connector ............................................................................................................. 4 2.1 6-Pin Connector ............................................................................................................. 5 2.2

3\. Connecting Simple eData to a PC........................................................................................... 6

Getting Diagnostics from the Device ................................................................................. 6 3.1 Available Actions ............................................................................................................ 7 3.2 File Menu Options ........................................................................................................... 8 3.3

4\. Setting Device Parameters .................................................................................................... 9

5\. Setting Rules ....................................................................................................................... 11

Adding Rules ................................................................................................................. 12 5.1 Using Functions in Rules ................................................................................................. 13 5.2 Available Operators ....................................................................................................... 14 5.3 Configuring Rules .......................................................................................................... 16 5.4 Editing Rules ................................................................................................................. 16 5.5 Removing Rules ............................................................................................................ 16 5.6

6\. Defining Histograms ............................................................................................................ 17

Adding Histograms and a Main Parameter ......................................................................... 18 6.1 Adding Related Simple Parameters .................................................................................. 20 6.2 Editing Histograms ........................................................................................................ 21 6.3

7\. Viewing Definitions ............................................................................................................. 22

Viewing Parameter Events .............................................................................................. 22 7.1 Viewing Rule Events ....................................................................................................... 22 7.2 Viewing Histogram Events .............................................................................................. 23 7.3 Viewing Fault Codes ....................................................................................................... 25 7.4

8\. Deleting Rules or Histograms .............................................................................................. 26

9\. Saving and Loading Settings ............................................................................................... 27

10\. Upgrading the Firmware Version ......................................................................................... 28

## PDF page 3

[Open original page](source/original.pdf#page=3)

### 1. Overview of Simple eData

Simple eData supports extracting and analyzing vehicle data using any of the following protocols: FMS, CANBus, and OBD.

Using the Simple eData Monitor, you can:

- Determine which parameters are set in the device and the time interval for sending those parameter values to the server.

- Define rules (the conditions which trigger alerts and notifications).

- Define histograms, which enable you to create graphs and tables which display multiple parameters on a timeline. This includes:

- A main parameter for which you define a range of values and the number of

columns by which that range is subdivided, which can be split into a maximum of twenty subranges.

- A maximum of five related simple parameters whose values can be

evaluated in relation to the main parameter's subranges.

For details, see the "Defining Histograms" section.

- Create and send server commands to the device using GPRS. For details, see the "Saving and Loading Settings" section.

- View Parameters Events

- View Rules Events

- View Histograms Events

- View Diagnostic Trouble Codes (DTC)

- Upgrade device version

- Get diagnostics from the device

## PDF page 4

[Open original page](source/original.pdf#page=4)

### 2. Installing Simple eData in a Vehicle

Simple eData is physically connected to a StarLink device using the 4-pin connector; and to the vehicle’s communication wires (CANBus / J1708 / K-Line) using the 6-pin connector.

### 2.1 4-Pin Connector

Use Simple eData’s 4-pin connector to connect to the StarLink device.

| Pin # | Description | Color |
| ----- | ----------- | ----- |

| Pin # | Description         | Color |
| ----- | ------------------- | ----- |
| 1     | GND                 | Black |
| 2     | POWER (+30)         | Red   |
| 3     | eNet(communication) | Gray  |
| 4     | IGN (+15)           | Green |

**Images on this page:** [Image 004](images.md#image-004), [Image 005](images.md#image-005).

[Illustrations with their page annotations](images/context-page-004.png).

## PDF page 5

[Open original page](source/original.pdf#page=5)

### 2.2 6-Pin Connector

Use Simple eData’s 6-pin connector to connect to the vehicle's CANBus or to the OBD.

| Pin # | Description |
| ----- | ----------- |

| Pin # | Description           |
| ----- | --------------------- |
| 1     | CAN H                 |
| 2     | 1708 Low (PWM + VPW)  |
| 3     | 1708 High (PWM + VPW) |
| 4     | Not in use            |
| 5     | (K-line)              |
| 6     | CAN L                 |

**Images on this page:** [Image 006](images.md#image-006).

[Illustrations with their page annotations](images/context-page-005.png).

## PDF page 6

[Open original page](source/original.pdf#page=6)

### 3. Connecting Simple eData to a PC

1\. Connect the LIN Adaptor to the PC.

2\. Connect the Simple eData device to the eNet Hub.

3\. In the first drop-down list, choose the Com port.

If you want to verify the port using your computer’s device manager, Open the Device Manager, and you can see which port is identified as the ERM Virtual Serial Port.

4\. Select Generic in the second drop-down list

5\. Click Connect.

A following message is displayed.

### 3.1 Getting Diagnostics from the Device

During the installation and connection procedure, you can get diagnostic information from the device.

1\. Click Help.

2\. Click Get Diagnostic from Device.

The following window is displayed with details, such as the Ignition and CANBus states. In this example, the vehicle is working with CANBus and j1708.

**Images on this page:** [Image 007](images.md#image-007), [Image 008](images.md#image-008), [Image 009](images.md#image-009).

## PDF page 7

[Open original page](source/original.pdf#page=7)

Note: The device does not transmit data when the Ignition is Off.

### 3.2 Available Actions

The left panel contains a set of action buttons which are available in all of the application's pages.

**Images on this page:** [Image 011](images.md#image-011), [Image 012](images.md#image-012).

## PDF page 8

[Open original page](source/original.pdf#page=8)

The following actions are available:

- Disconnect from the device.

- Set Settings to save the parameters to the device.

Note: Only the parameters are sent to the device. The car type is only sent

when you click Set Vehicle.

- Get Settings - Reads the saved setting on the device, the stored parameters and the time intervals for reporting.

- Set Vehicle - Sets the vehicle category and type to the device.

Note: Once both the Settings and the Vehicle are set to the device, the

Simple eData device starts monitoring and reporting.

- Get Vehicle - Reads the vehicle category and type as set in the device. The values are reflected in the relevant drop-down lists.

- Reset - Restarts the device. It is a simple power down and power up without restoring the default values.

### 3.3 File Menu Options

From the File menu, the following options are available:

- Open Settings File - The Open Settings File window opens, enabling you to select a file to open.

- Open Events Log File - The Open Events Log File window opens, enabling you to select a file to open.

- Save/Save As - Saves the data on parameters, rules, histograms, and event histories.

- Create Server Commands - Creates a Server Commands file, which you can then use to send commands by GPRS.

**Images on this page:** [Image 013](images.md#image-013), [Image 014](images.md#image-014).

## PDF page 9

[Open original page](source/original.pdf#page=9)

### 4. Setting Device Parameters

Parameters are the building blocks of rules, which determine which events are noteworthy, important, or require attention.

1\. Click the Parameters tab.

2\. In the first drop-down list, select the vehicle category.

3\. In the second drop-down list, select the specific vehicle type.

- The list of vehicle types changes according to your selection in the vehicle

category drop-down list.

- The parameters stored in the Simple eData device are displayed.

Note: Different vehicle types support different sets of parameters.

4\. Set the time interval in seconds to determine how frequently to check each parameter's value in the device and send to the server.

Each device can only store 100 parameters while a vehicle car type can have more than 100 associated parameters. You need to choose which parameters you want to set in the device.

- A positive value in the time interval field indicates that the parameter will be

used in the device.

- A value of 0 in the time interval field indicates that the parameter will not be

used.

If there are more than 100 parameters configured for use in the device, the following message is displayed.

The first 100 parameters are used. You can set some parameters to 0 (not in use) to make room for other parameters.

The progress bar at the bottom of the screen indicates how much of the device's parameter storage capacity is already used.

**Images on this page:** [Image 015](images.md#image-015), [Image 016](images.md#image-016).

## PDF page 10

[Open original page](source/original.pdf#page=10)

5\. {Optional} Enter free-text in the Filter field to narrow the list of parameters.

6\. {Optional} Set the time interval for all parameters to the same value simultaneously by entering a value in the Set all intervals field and pressing Enter.

**Images on this page:** [Image 017](images.md#image-017), [Image 018](images.md#image-018).

## PDF page 11

[Open original page](source/original.pdf#page=11)

### 5. Setting Rules

Rules are used to define which events you want to monitor. You can define a maximum of 100 rules.

Rules can be based on other rules. For example, one parameter's value can be the result of another rule.

Remember that before you define rules, you must define the parameters that will be used in the rules. For details on defining parameters, see the "Setting Device Parameters" section.

**Images on this page:** [Image 019](images.md#image-019).

## PDF page 12

[Open original page](source/original.pdf#page=12)

### 5.1 Adding Rules

To add a rule:

1\. In the Rules tab, click Add Rule.

2\. Define the rule in the Edit Rule area using:

- The available parameters listed in the left panel.

- The operators and functions displayed in the right panel. For details, see

"Using Operators and Functions".

You can select multiple parameters; and multiple operators and functions.

3\. Click Save Rule.

The rule is automatically assigned a Rule ID and listed in the Rules List. The Rule Result area displays the Hex value for the rule's code. If the rule has a syntax error, the following text is displayed: There is a syntax error in the rule definition!

4\. In the Rule Name column of the Rules List, enter a descriptive name for the rule.

5\. {Optional} Configure whether a rule's results are continuously reported to the server using the True Event ID and False Event ID columns. See "Configuring Rules".

**Images on this page:** [Image 020](images.md#image-020), [Image 021](images.md#image-021).

## PDF page 13

[Open original page](source/original.pdf#page=13)

6\. In the Rule Debounce Time column, you can specify the minimal time in milliseconds that the event needs to occur before it reports the results to the server.

This is useful for preventing the reporting of false events due to noise and local variations.

7\. Click Save Rule.

The rule is added to the list of rules at the bottom of the Rules page.

### 5.2 Using Functions in Rules

Functions are always used as the first element of a Rule definition. There are three available functions:

- -

a) Click the TimeOf function.

It appears in the Edit Rule area as shown.

b) Double click in the parenthesis containing the question marks.

c) Double-click a parameter in Add Parameter to Rule area that you want the

TimeOf function to count.

**Images on this page:** [Image 022](images.md#image-022), [Image 023](images.md#image-023), [Image 024](images.md#image-024).

[Illustrations with their page annotations](images/context-page-013.png).

## PDF page 14

[Open original page](source/original.pdf#page=14)

The parameter is added to the Rule. For example, double-click the Fuel Level % parameter. The Rule is updated as shown.

d) Add a condition within the parenthesis. For example, the following

condition is when the fuel level percentage is greater than 50%.

e) Add an operator and a value to define when to report an event.

In this example, the &gt; 5000 indicates that an event is sent only if the condition you defined is met for more than 5000 milliseconds.

- - Use this function to count how many times the condition you defined was met. In the following example, eData calculates how many times the ACC value was 1. If the value was 1 more than 10 times, it sends an event.

$Sum( [ACC] = 1) &gt; 10

- - Use the sum function, for example, to add the value of one parameter to the value of another.

### 5.3 Available Operators

The following types of operators are available:

The available operators include the following:

- Mathematical operators: - +, -, *, /, =, != (not equal)

- Relational operators: &gt;, &lt;, &gt;=, &lt;=

Returns 0 if the specified relation is false, and 1 if it is true.

**Images on this page:** [Image 025](images.md#image-025), [Image 026](images.md#image-026), [Image 027](images.md#image-027), [Image 028](images.md#image-028), [Image 029](images.md#image-029).

[Illustrations with their page annotations](images/context-page-014.png).

## PDF page 15

[Open original page](source/original.pdf#page=15)

- Absolute difference operator: Returns the absolute value of the difference between the operands.

- Logical operators: Compare Boolean expressions, and return a Boolean result:

- - Returns a true value if at least one operand is true.

- - Returns a true value only if both operands are true.

- - Yields the remainder when you divide one number by another.

- - Clears all spaces from the equation.

- - Clears all text from the Edit Rule area.

- Add parenthesis to equation - Adds parenthesis around everything currently in the Edit Rule area at the cursor's current location.

**Images on this page:** [Image 030](images.md#image-030), [Image 031](images.md#image-031), [Image 032](images.md#image-032), [Image 033](images.md#image-033), [Image 034](images.md#image-034), [Image 035](images.md#image-035), [Image 036](images.md#image-036), [Image 037](images.md#image-037).

[Illustrations with their page annotations](images/context-page-015.png).

## PDF page 16

[Open original page](source/original.pdf#page=16)

### 5.4 Configuring Rules

You can define whether to continuously report rule results to the server, set the following parameters:

- True Event ID - Indicates that the rule condition is true after it was false.

- False Event ID - Indicates that the rule condition is false after it was true.

A value of 0 for either Event ID means that the rule results are not reported to the server. This is useful if a rule result is used only for calculation.

- If a rule is arithmetic, it is recommended to specify 0.

- Otherwise, the server will be inundated with the arithmetic rule results, which

are reported every 100 milliseconds.

- Rule debounce time - The time which must elapse before sending an event to the server.

For logical rules (which return a Boolean result), enter positive numbers to indicate how to report the rule results. For example: As an administrator, if you want to be notified whenever the driver applies the brakes for 30 consecutive seconds, you would define a rule with a Debounce Time of 30 seconds.

The ID number that you set corresponds to the Event ID sent to the server when the conditions of the rule are met.

### 5.5 Editing Rules

You can edit the definitions of any rule.

To do so:

1\. Select a rule in the list, and click Start Edit Rule.

You can then edit the settings in the Edit Rule section, as well as the values in the True Event ID, False Event ID, and Rule Debounce Time cells.

2\. Click Finish Edit Rule.

### 5.6 Removing Rules

You can remove a rule either from the list, the device, or both. For details, see "Deleting Rules or Histograms".

**Images on this page:** [Image 038](images.md#image-038).

## PDF page 17

[Open original page](source/original.pdf#page=17)

### 6. Defining Histograms

Histograms enable accumulating a number of data points within a range of values, divided into equal intervals, and displayed in tabular format.

You can define a maximum of 10 histograms.

For example, you might want to define a range of Engine RPM values of 0 - 6000. Then define the number of columns by which the total range is subdivided. The first column is counted as 0. If you select 6 for Total Histogram columns, the range for each column is as shown.

|             | Column 0 | Column 1    | Column 2    | Column 3    | Column 4    | Column 5    |
| ----------- | -------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| Total Count | 0 - 1000 | 1000 - 2000 | 2000 - 3000 | 3000 - 4000 | 4000 - 5000 | 5000 - 6000 |

| Code / field           | Description                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| Additional Parameter 1 | Actual parameter value, cumulative See "Adding Related Parameters". |
| Additional Parameter 2 | Actual parameter value, cumulative                                  |

The simple eData device receives the Engine RPM parameter values, and checks which column the value falls into. The Total count column represents the number of times the parameter value matches the range for that column. The value in each column is the number of milliseconds that the parameter values fell into the specified range.

Values of histogram parameters are checked every 100 milliseconds. This interval is not configurable. However, you can define how often the values are sent from simple eData to the server.

For details, see:

- Adding Histograms

- Editing Histograms

- Viewing Histogram Events

[Illustrations with their page annotations](images/context-page-017.png).

## PDF page 18

[Open original page](source/original.pdf#page=18)

### 6.1 Adding Histograms and a Main Parameter

You can define a maximum of ten histograms and up to five related parameters per histogram.

To add a histogram:

1\. Click the Histogram tab.

2\. Click Add Histogram.

The Histogram Settings area is displayed, and the Add Histogram button changes to Save Histogram.

3\. Define the Histogram settings as follows:

a) In the Histogram ID field, enter an ID number for the histogram.

If the simple eData device already has a histogram with that ID, the histogram will be overridden. There is no warning prompt for this scenario, but you can check existing Histogram IDs by clicking Get Settings and then viewing Histograms.

b) In the Histogram Name field, enter a descriptive name.

**Images on this page:** [Image 039](images.md#image-039), [Image 040](images.md#image-040).

## PDF page 19

[Open original page](source/original.pdf#page=19)

c) Click the Add New Histogram into the Histograms List icon to select

the main histogram parameter.

You can only have one main parameter in a histogram.

The Add Simple Parameter window appears, listing all the parameters defined in the Parameters page.

d) Select the main parameter for the histogram and click the Accept icon .

e) Specify the Start Histogram Range and End Histogram Range in the

corresponding fields.

You can either specify the full range of values that the parameter is likely to have, or focus on the subset in which you are interested.

f) Specify the number of columns in the Total Histogram Columns field.

The value of the One Column Range is updated with the total range ÷ the number of columns.

g) In the Send Histogram Time Interval field, specify how frequently the

device sends all accumulated histogram data to the server since the last report was sent.

The device begins sending reports to the server.

**Images on this page:** [Image 041](images.md#image-041), [Image 042](images.md#image-042), [Image 043](images.md#image-043).

## PDF page 20

[Open original page](source/original.pdf#page=20)

### 6.2 Adding Related Simple Parameters

You can also define up to five related simple parameters to get reports on these parameter values in the context of the main parameter values. For example, you could add a total fuel consumption parameter to chart the total fuel consumption when the RPM was in the range for any of the main parameter columns.

Note: The parameters you are tracking for the histogram must be defined in

the Parameters page before you can define the histogram.

You do not define ranges or other settings for any additional parameters. The actual values of those parameters are reported on a cumulative basis. Each time a new value is received, it is summed with the previous total. You can then divide the total fuel consumption by the value for EngineRPM to get the average fuel consumption for that RPM range.

To add related parameters:

1\. Click Add Parameter to Histogram.

The Add Simple Parameter window lists all the parameters defined in the Parameters page.

2\. Select the related parameter and click .

The additional parameters are added to the Related Histogram Parameters list. You can only select one simple parameter at a time to add. After accepting the addition of this parameter, you can add another as long as you do not exceed the maximum of five.

**Images on this page:** [Image 044](images.md#image-044), [Image 043](images.md#image-043), [Image 045](images.md#image-045).

## PDF page 21

[Open original page](source/original.pdf#page=21)

A warning message is displayed if you do exceed the maximum number of parameters.

3\. Click Save Histogram.

The histogram is added to the list of histograms at the bottom of the page.

### 6.3 Editing Histograms

You can edit the definitions of any histogram.

1\. Select a histogram from the list.

You can click in any of the columns for that histogram.

2\. Click Start Edit Histogram.

The Histogram Settings area is populated with the settings for the selected histogram.

3\. Edit the settings, as described in the "Adding Histograms" section.

4\. Click Finish Edit Histogram.

**Images on this page:** [Image 046](images.md#image-046), [Image 047](images.md#image-047), [Image 048](images.md#image-048), [Image 049](images.md#image-049).

## PDF page 22

[Open original page](source/original.pdf#page=22)

### 7. Viewing Definitions

### 7.1 Viewing Parameter Events

When the Simple eData is connected to the Simple eData GUI using a serial connection, the Parameter Events tab displays a detailed parameters report.

Each parameter includes the following data:

- Parameter ID - The parameter’s ID as it appears in the Parameters tab.

- Parameter Name - The Parameter Name as it appears in the Parameters

tab.

- Parameter Type - The parameter’s Type as it appears in the Parameters tab.

- Last Received Value - The most recently received parameter value.

- Last Update Time - The time when this rule was last updated in the Simple

eData Monitor.

- Report Type - Indicates what prompted Simple eData to report this

parameter. The report types are:

o Periodic Report - The parameter is reported according to the time interval setting in the Parameters tab

You have the following options:

- Select the Always Add Parameter Events to List checkbox if you want each report of a parameter value to be added as a new line in the events list.

If you clear the checkbox, each new value reported replaces the previously reported value.

- Select the Show Values in Hex Format checkbox to display values in the Last Received Value column in Hex format.

- Click Clear History to delete all entries in the tab.

- Click Save History to create a CSV file of all parameter event details.

### 7.2 Viewing Rule Events

When the Simple eData is connected to the Simple eData GUI using a serial connection, the Rule Events tab displays the Rule Events report.

**Images on this page:** [Image 050](images.md#image-050), [Image 051](images.md#image-051).

## PDF page 23

[Open original page](source/original.pdf#page=23)

For example, if you defined an Engine RPM parameter, and an Engine RPM &gt; 3000 rule, when the vehicle’s engine reaches an RPM &gt; 3000, the event is displayed in Rule Events tab.

Each event includes the following information:

- Rule ID - The Rule ID as it appears in the Rules tab.

- Rule Name - The Rule Name as it appears in the Rules tab.

- Event ID - The ID indicates whether the event defined by a rule occurred or stopped occurring. See "Configuring Rules."

- Rule Time - How long the event lasted, since it started occurring until it stopped.

- Rule Count - The number of times this rule occurred since the beginning of the trip.

- Last Update Time - The time when this rule was last updated in the Simple eData Monitor.

You have the following options:

- Select the Always Add Rule Events to List checkbox if you want every instance of an event triggered by a rule to be added to the list. Clear the checkbox if you want each new instance to replace the last instance.

- Click Clear History to delete all the entries in this tab.

- Click Save History to create a CSV file of the data displayed in this tab.

### 7.3 Viewing Histogram Events

When the Simple eData is connected to the Simple eData GUI using a serial connection, the reported histograms are displayed in the Histogram Events tab.

Histogram data is displayed in the GUI in a table with each histogram report presented in a separate table.

**Images on this page:** [Image 052](images.md#image-052).

## PDF page 24

[Open original page](source/original.pdf#page=24)

The heading row of the table displays the histogram name, and the last time the data was updated.

- The Total Count row shows the accumulated values for the main histogram parameter, in each of the defined columns (bins).

- If you defined related histogram parameters, the accumulated values of each parameter is shown in a separate row.

Histogram data is available in graphical format only on the server side. The following graph shows a histogram with only the main parameter defined.

The following graph shows a histogram with a main parameter and one related parameter.

You have the following options:

- Select the Always Add Histogram Events to List checkbox to accumulate each event instance in a list. Clear the checkbox if you want each new histogram event to replace the last reported histogram.

- Click Clear History to delete all entries in the tab.

- Click Save History to create a CSV file of the histogram events.

**Images on this page:** [Image 053](images.md#image-053), [Image 054](images.md#image-054).

[Illustrations with their page annotations](images/context-page-024.png).

## PDF page 25

[Open original page](source/original.pdf#page=25)

### 7.4 Viewing Fault Codes

If the device is configured to work in OBD mode, click the DTC tab to view Diagnostic Trouble Codes.

Each line in the Fault Codes page corresponds to a fault being reported, and provides the following information about the fault:

- Fault Code Real ID - The actual fault data received from the vehicle.

- Fault Code Description - A translation of the data into know fault codes (OBD DTC codes).

- Fault Code Status - Added, Removed

- Last Update Time - The time when this fault code was last updated in the Simple eData Monitor.

You have the option to:

- Select the Always Add Fault Codes to List checkbox if you want each fault code instance to be added to the list. Clear the checkbox if you want the current fault code instance to replace the last reported instance of the same fault code.

- Click Clear History to delete all entries in this tab.

- Click Save History to create a CSV file of the fault code data.

**Images on this page:** [Image 055](images.md#image-055).

## PDF page 26

[Open original page](source/original.pdf#page=26)

### 8. Deleting Rules or Histograms

You can delete rules or histograms either from the Simple eData Monitor, the device, or both. To delete from the device, the computer running the Simple eData Monitor must also be physically connected to the Simple eData device.

To delete rules or histograms:

1\. Do one of the following:

- Right-click the line for a particular entity (rule, or histogram).

- To delete all rules, or histograms, right-click anywhere in the page.

The following options are displayed.

If the Simple eData device and the Simple eData Monitor are not physically

connected, all options which require a physical connection are disabled.

2\. Select one of the following actions. The relevant options are also available if you right-click in the context of a rule or histogram:

- Remove parameter from list - Deletes the parameter from the list in the

Simple eData Monitor, but does not delete it from the Simple eData device.

You can also perform the same action by clicking the Remove Parameter button.

- Remove parameter from device - Deletes the parameter from the Simple

eData device, but does not delete it from the Simple eData Monitor.

- Remove parameter from list and device - Deletes the parameter from both

the Simple eData device and the Simple eData Monitor.

- Delete all parameters - Deletes all the parameter defined in Simple eData

Monitor, but does not delete them from Simple eData device.

- Delete all parameters in device - Deletes all the parameters defined in the

Simple eData device, but does not delete them from the Simple eData Monitor.

- Delete all parameters in device and monitor - Deletes all parameters from

both the Simple eData device and the Simple eData Monitor.

**Images on this page:** [Image 056](images.md#image-056).

## PDF page 27

[Open original page](source/original.pdf#page=27)

### 9. Saving and Loading Settings

You can save and load Simple eData Monitor definitions for parameters, rules, and histograms, in any of the following ways:

- Click File &gt; Create Server Commands to save all definitions as a .txt commands file.

The commands file can then be sent to one or multiple Simple eData devices using GPRS.

- Click File &gt; Save As to save all definitions as an .ini configuration file.

This file can be sent to a Simple eData device if it is connected serially to the Simple eData Monitor.

- Click File &gt; Open Settings File to browse to an .ini configuration file, and click Open.

Each time you open the Simple eData Monitor, the default .ini file is applied.

## PDF page 28

[Open original page](source/original.pdf#page=28)

### 10. Upgrading the Firmware Version

1\. The .ini upgrade file must be stored on your network.

2\. Connect to the device using a serial connection.

3\. Click the Version Upgrade tab.

4\. Click the Browse button, navigate to the upgrade file, and select it.

5\. Click Burn.

6\. A progress bar with an online burning percentage number is shown at the bottom of the monitor until the end of burning.

**Images on this page:** [Image 057](images.md#image-057).
