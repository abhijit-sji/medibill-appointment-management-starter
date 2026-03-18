# Appointment Management - Layout

## Page Layout Map

### CalendarPage (`/calendar`)

```
+-----------------------------------------------------------------------+
| Layout (authenticated)                                                 |
| +-------------------------------------------------------------------+ |
| | Header: "Calendar" + Stats Cards Row                              | |
| | +------+ +------+ +------+ +------+ +------+ +------+           | |
| | |Today | |Week  | |Month | |Active| |Check | |No    |           | |
| | |Count | |Count | |Count | |Provs | |Ins   | |Shows |           | |
| | +------+ +------+ +------+ +------+ +------+ +------+           | |
| +-------------------------------------------------------------------+ |
| | Toolbar Row                                                       | |
| | [< Prev] [Date Display] [Next >] | [Day|Week|Month] | [+Add]    | |
| | [Provider Filter Multi-Select] [Search] [Sync] [Export]          | |
| +-------------------------------------------------------------------+ |
| | Calendar Body                                                     | |
| | +---------------------------------------------------------------+ | |
| | | react-big-calendar                                             | | |
| | | - Day View: Hourly grid with appointment blocks                | | |
| | | - Week View: 7-day grid with appointments                     | | |
| | | - Month View: Month grid with appointment dots                 | | |
| | +---------------------------------------------------------------+ | |
| +-------------------------------------------------------------------+ |
| | Dialogs (modal overlays):                                         | |
| | - Appointment Details Dialog (view/edit status)                   | |
| | - AddAppointmentDialog (create new)                               | |
| | - RescheduleDialog (change date/time)                             | |
| +-------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

### Availabilities Page (`/availabilities`)

```
+-----------------------------------------------------------------------+
| Layout (authenticated)                                                 |
| +-------------------------------------------------------------------+ |
| | Header: "Provider Availabilities"                                  | |
| | Stats Cards: [Total Providers] [With Schedule] [Total Slots]      | |
| |              [Upcoming Overrides]                                  | |
| +-------------------------------------------------------------------+ |
| | Toolbar: [Search] [Provider Filter] [NexHealth Sync] [+ Add]     | |
| +-------------------------------------------------------------------+ |
| | Availabilities Table                                              | |
| | +---------------------------------------------------------------+ | |
| | | Provider | Day | Start | End | Location | Operatory | Actions | | |
| | |----------|-----|-------|-----|----------|-----------|---------|  | |
| | | Dr. Smith| Mon | 08:00 | 17:00| Main   | Room 1    | [E][D] | | |
| | | Dr. Smith| Tue | 08:00 | 17:00| Main   | Room 1    | [E][D] | | |
| | +---------------------------------------------------------------+ | |
| +-------------------------------------------------------------------+ |
| | Side Panels / Dialogs:                                            | |
| | - Create/Edit Availability Sheet                                  | |
| | - Weekly Schedule Setup Dialog                                    | |
| | - Override Management Panel                                       | |
| | - Delete Confirmation AlertDialog                                 | |
| +-------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

### AppointmentTypes Page (`/appointment-types`)

```
+-----------------------------------------------------------------------+
| Layout (authenticated)                                                 |
| +-------------------------------------------------------------------+ |
| | Header: "Appointment Types"                                        | |
| | Stats Cards: [Total] [Active] [Online Bookable] [Categories]     | |
| +-------------------------------------------------------------------+ |
| | Toolbar: [Search] [Category Filter] [Institution Filter]          | |
| |          [NexHealth Sync Dropdown] [+ Add]                        | |
| +-------------------------------------------------------------------+ |
| | Appointment Types Table                                           | |
| | +---------------------------------------------------------------+ | |
| | | Name | Code | Duration | Price | Online | Category | Actions  | | |
| | |------|------|----------|-------|--------|----------|---------- | | |
| | | Clean| CLN  | 60 min   | $150  | Yes    | Hygiene  | [E][D]  | | |
| | | Exam | EXAM | 30 min   | $100  | Yes    | General  | [E][D]  | | |
| | +---------------------------------------------------------------+ | |
| +-------------------------------------------------------------------+ |
| | Dialogs:                                                          | |
| | - AddAppointmentTypeDialog                                        | |
| | - EditAppointmentTypeDialog                                       | |
| | - Delete Confirmation AlertDialog                                 | |
| +-------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

### Operatories Page (`/operatories`)

```
+-----------------------------------------------------------------------+
| Layout (authenticated)                                                 |
| +-------------------------------------------------------------------+ |
| | Header: "Operatories"                                              | |
| | Stats Cards: [Total] [Active] [Inactive] [Bookable]              | |
| +-------------------------------------------------------------------+ |
| | Toolbar: [Search] [Institution Filter] [Type Filter]              | |
| |          [NexHealth Sync] [+ Add Operatory]                       | |
| +-------------------------------------------------------------------+ |
| | Operatories Table                                                  | |
| | +---------------------------------------------------------------+ | |
| | | Name | Type | Institution | Location | Active | Book | Actions| | |
| | |------|------|-------------|----------|--------|------|--------| | |
| | | Op 1 | Gen  | Main Inst   | Floor 1  | Yes    | Yes  | [...] | | |
| | +---------------------------------------------------------------+ | |
| +-------------------------------------------------------------------+ |
| | Dialogs:                                                          | |
| | - AddOperatoryDialog                                              | |
| | - EditOperatoryDialog                                             | |
| | - Delete Confirmation AlertDialog                                 | |
| +-------------------------------------------------------------------+ |
+-----------------------------------------------------------------------+
```

## UI Component Library Usage

| Component | Source | Usage |
|-----------|--------|-------|
| `Card`, `CardHeader`, `CardContent`, `CardTitle` | shadcn/ui | Stats cards, content containers |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` | shadcn/ui | Data tables on all pages |
| `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` | shadcn/ui | Appointment details, create/edit forms |
| `AlertDialog` | shadcn/ui | Delete confirmations |
| `Sheet`, `SheetContent` | shadcn/ui | Side panels (availability editing) |
| `Select`, `SelectContent`, `SelectItem` | shadcn/ui | Provider filter, type filter, dropdowns |
| `Badge` | shadcn/ui | Status badges, type labels |
| `Button` | shadcn/ui | Actions, toolbar buttons |
| `Input` | shadcn/ui | Search, form fields |
| `Switch` | shadcn/ui | Active/inactive toggles |
| `Label` | shadcn/ui | Form field labels |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | shadcn/ui | View mode tabs |
| `Popover` | shadcn/ui | Filter popovers |
| `Checkbox` | shadcn/ui | Multi-select provider filtering |
| `DropdownMenu` | shadcn/ui | Action menus, sync options |
| `Skeleton` | shadcn/ui | Loading states |
| `Calendar` | react-big-calendar | Main calendar visualization |

## Responsive Behavior

- Calendar view defaults to day view on smaller screens
- Stats cards wrap to multiple rows on mobile
- Tables become horizontally scrollable
- Dialogs use full-width on mobile via `DialogContent` max-width
- Provider filter collapses to dropdown on narrow viewports
