use serde::{Deserialize, Serialize};

/// An Apple Calendar event (for display in DayView alongside EDN sessions)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleCalendarEvent {
    pub id: String,
    pub title: String,
    pub start_time: String, // ISO datetime (local time)
    pub end_time: String,
    pub calendar_title: String,
}

/// Current authorization status for calendar access
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CalendarAuthStatus {
    NotDetermined,
    Authorized,
    Denied,
    Restricted,
}

/// Check calendar authorization status (no permission prompt)
#[tauri::command]
pub async fn get_calendar_auth_status() -> Result<CalendarAuthStatus, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(macos::auth_status)
            .await
            .map_err(|e| format!("task error: {e}"))?
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(CalendarAuthStatus::Denied)
    }
}

/// Open System Settings → Privacy → Calendars so the user can grant access.
/// Returns true if the settings pane was opened successfully.
#[tauri::command]
pub async fn request_calendar_permission() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(macos::open_calendar_privacy_settings)
            .await
            .map_err(|e| format!("task error: {e}"))?
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

/// Export an EDN session to Apple Calendar.
/// `specialty_name` controls which calendar is used (e.g. "EDN - Cardiologie").
/// Returns the Apple Calendar event identifier.
#[tauri::command]
pub async fn export_session_to_apple_calendar(
    title: String,
    start_time: String,
    end_time: String,
    notes: Option<String>,
    specialty_name: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || {
            let cal_name = specialty_name
                .filter(|s| !s.is_empty())
                .map(|s| format!("EDN – {s}"))
                .unwrap_or_else(|| "EDN Tracker".to_string());
            macos::create_event(&title, &start_time, &end_time, notes.as_deref(), &cal_name)
        })
        .await
        .map_err(|e| format!("task error: {e}"))?
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Apple Calendar sync is only available on macOS".to_string())
    }
}

/// Import Apple Calendar events for a date range (for display in DayView)
#[tauri::command]
pub async fn import_apple_calendar_events(
    date_from: String,
    date_to: String,
) -> Result<Vec<AppleCalendarEvent>, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || macos::fetch_events(&date_from, &date_to))
            .await
            .map_err(|e| format!("task error: {e}"))?
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(vec![])
    }
}

/// Delete an event from Apple Calendar by its identifier
#[tauri::command]
pub async fn delete_apple_calendar_event(event_id: String) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        tokio::task::spawn_blocking(move || macos::delete_event(&event_id))
            .await
            .map_err(|e| format!("task error: {e}"))?
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}

// ─── macOS EventKit implementation ──────────────────────────────────────────

#[cfg(target_os = "macos")]
mod macos {
    use super::{AppleCalendarEvent, CalendarAuthStatus};
    use objc2::rc::autoreleasepool;
    use objc2::runtime::AnyObject;
    use objc2::{class, msg_send};
    use objc2_foundation::NSString;

    // EKEntityType::Event = 0
    const EK_ENTITY_TYPE_EVENT: u64 = 0;
    // EKSpan::ThisEvent = 0
    const EK_SPAN_THIS_EVENT: i64 = 0;
    // EKAuthorizationStatus values
    const EK_STATUS_NOT_DETERMINED: i64 = 0;
    const EK_STATUS_RESTRICTED: i64 = 1;
    const EK_STATUS_DENIED: i64 = 2;

    /// Get authorization status without prompting (synchronous)
    pub fn auth_status() -> Result<CalendarAuthStatus, String> {
        unsafe {
            autoreleasepool(|_| {
                let status: i64 = msg_send![
                    class!(EKEventStore),
                    authorizationStatusForEntityType: EK_ENTITY_TYPE_EVENT
                ];
                Ok(match status {
                    EK_STATUS_NOT_DETERMINED => CalendarAuthStatus::NotDetermined,
                    EK_STATUS_RESTRICTED => CalendarAuthStatus::Restricted,
                    EK_STATUS_DENIED => CalendarAuthStatus::Denied,
                    _ => CalendarAuthStatus::Authorized, // 3 = Authorized, 4 = FullAccess (macOS 14+)
                })
            })
        }
    }

    /// Open System Settings → Privacy & Security → Calendars
    /// so the user can manually grant access.
    pub fn open_calendar_privacy_settings() -> Result<bool, String> {
        unsafe {
            autoreleasepool(|_| {
                let url_str = NSString::from_str(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars",
                );
                let url: *mut AnyObject = msg_send![
                    class!(NSURL),
                    URLWithString: &*url_str as *const NSString
                ];
                if url.is_null() {
                    return Ok(false);
                }
                let workspace: *mut AnyObject = msg_send![class!(NSWorkspace), sharedWorkspace];
                let success: bool = msg_send![workspace, openURL: url];
                Ok(success)
            })
        }
    }

    /// Find or create a local calendar with the given name.
    unsafe fn find_or_create_calendar(store: *mut AnyObject, name: &str) -> *mut AnyObject {
        let ns_name = NSString::from_str(name);

        // Get all calendars (EKEntityType::Event = 0)
        let cals: *mut AnyObject = msg_send![store, calendarsForEntityType: 0u64];
        if !cals.is_null() {
            let count: usize = msg_send![cals, count];
            for i in 0..count {
                let cal: *mut AnyObject = msg_send![cals, objectAtIndex: i];
                if cal.is_null() { continue; }
                let cal_title: *mut AnyObject = msg_send![cal, title];
                let cal_utf8: *const std::os::raw::c_char = msg_send![cal_title, UTF8String];
                if !cal_utf8.is_null() {
                    let cal_name = std::ffi::CStr::from_ptr(cal_utf8).to_string_lossy();
                    if cal_name == name {
                        return cal;
                    }
                }
            }
        }

        // Create new local calendar
        let alloc_cal: *mut AnyObject = msg_send![class!(EKCalendar), alloc];
        let new_cal: *mut AnyObject = msg_send![alloc_cal, initWithEventStore: store];
        if new_cal.is_null() {
            return std::ptr::null_mut();
        }
        let _: () = msg_send![new_cal, setTitle: &*ns_name as *const NSString];

        // Use the local source
        let sources: *mut AnyObject = msg_send![store, sources];
        let src_count: usize = if sources.is_null() { 0 } else { msg_send![sources, count] };
        for i in 0..src_count {
            let src: *mut AnyObject = msg_send![sources, objectAtIndex: i];
            // EKSourceType::Local = 0
            let src_type: i64 = msg_send![src, sourceType];
            if src_type == 0 {
                let _: () = msg_send![new_cal, setSource: src];
                break;
            }
        }

        let mut err: *mut AnyObject = std::ptr::null_mut();
        let ok: bool = msg_send![store, saveCalendar: new_cal, commit: true, error: &mut err];
        if ok { new_cal } else { std::ptr::null_mut() }
    }

    /// Create an event in Apple Calendar. Returns the calendarItemIdentifier.
    pub fn create_event(
        title: &str,
        start_time: &str,
        end_time: &str,
        notes: Option<&str>,
        calendar_name: &str,
    ) -> Result<String, String> {
        unsafe {
            autoreleasepool(|_| {
                let alloc_store: *mut AnyObject = msg_send![class!(EKEventStore), alloc];
                let store: *mut AnyObject = msg_send![alloc_store, init];
                if store.is_null() {
                    return Err("Failed to create EKEventStore".to_string());
                }

                let start_ts = parse_iso_to_timestamp(start_time)?;
                let end_ts = parse_iso_to_timestamp(end_time)?;

                let start_ns: *mut AnyObject =
                    msg_send![class!(NSDate), dateWithTimeIntervalSince1970: start_ts];
                let end_ns: *mut AnyObject =
                    msg_send![class!(NSDate), dateWithTimeIntervalSince1970: end_ts];

                let event: *mut AnyObject =
                    msg_send![class!(EKEvent), eventWithEventStore: store];
                if event.is_null() {
                    return Err("Failed to create EKEvent".to_string());
                }

                let ns_title = NSString::from_str(title);
                let _: () = msg_send![event, setTitle: &*ns_title as *const NSString];
                let _: () = msg_send![event, setStartDate: start_ns];
                let _: () = msg_send![event, setEndDate: end_ns];

                if let Some(n) = notes {
                    if !n.is_empty() {
                        let ns_notes = NSString::from_str(n);
                        let _: () = msg_send![event, setNotes: &*ns_notes as *const NSString];
                    }
                }

                // Find or create specialty calendar
                let cal = find_or_create_calendar(store, calendar_name);
                let calendar = if !cal.is_null() {
                    cal
                } else {
                    msg_send![store, defaultCalendarForNewEvents]
                };
                if !calendar.is_null() {
                    let _: () = msg_send![event, setCalendar: calendar];
                }

                let mut error: *mut AnyObject = std::ptr::null_mut();
                let success: bool = msg_send![
                    store,
                    saveEvent: event,
                    span: EK_SPAN_THIS_EVENT,
                    commit: true,
                    error: &mut error
                ];

                if !success {
                    if !error.is_null() {
                        let desc: *mut AnyObject = msg_send![error, localizedDescription];
                        let c_str: *const std::os::raw::c_char = msg_send![desc, UTF8String];
                        let msg = std::ffi::CStr::from_ptr(c_str).to_string_lossy().into_owned();
                        return Err(format!("Failed to save event: {msg}"));
                    }
                    return Err("Failed to save event to Apple Calendar".to_string());
                }

                let id_ns: *mut AnyObject = msg_send![event, calendarItemIdentifier];
                let c_str: *const std::os::raw::c_char = msg_send![id_ns, UTF8String];
                let event_id = std::ffi::CStr::from_ptr(c_str).to_string_lossy().into_owned();

                Ok(event_id)
            })
        }
    }

    /// Fetch events from Apple Calendar for a date range
    pub fn fetch_events(
        date_from: &str,
        date_to: &str,
    ) -> Result<Vec<AppleCalendarEvent>, String> {
        unsafe {
            autoreleasepool(|_| {
                let alloc_store: *mut AnyObject = msg_send![class!(EKEventStore), alloc];
                let store: *mut AnyObject = msg_send![alloc_store, init];
                if store.is_null() {
                    return Err("Failed to create EKEventStore".to_string());
                }

                let start_ts = parse_iso_to_timestamp(date_from)?;
                let end_ts = parse_iso_to_timestamp(date_to)?;

                let start_ns: *mut AnyObject =
                    msg_send![class!(NSDate), dateWithTimeIntervalSince1970: start_ts];
                let end_ns: *mut AnyObject =
                    msg_send![class!(NSDate), dateWithTimeIntervalSince1970: end_ts];

                let predicate: *mut AnyObject = msg_send![
                    store,
                    predicateForEventsWithStartDate: start_ns,
                    endDate: end_ns,
                    calendars: std::ptr::null::<AnyObject>()
                ];

                let events_arr: *mut AnyObject =
                    msg_send![store, eventsMatchingPredicate: predicate];
                if events_arr.is_null() {
                    return Ok(vec![]);
                }

                let count: usize = msg_send![events_arr, count];
                let mut result = Vec::with_capacity(count);

                for i in 0..count {
                    let event: *mut AnyObject = msg_send![events_arr, objectAtIndex: i];
                    if event.is_null() {
                        continue;
                    }

                    let title_ns: *mut AnyObject = msg_send![event, title];
                    let title = ns_string_to_rust(title_ns);

                    let id_ns: *mut AnyObject = msg_send![event, calendarItemIdentifier];
                    let id = ns_string_to_rust(id_ns);

                    let start_date: *mut AnyObject = msg_send![event, startDate];
                    let end_date: *mut AnyObject = msg_send![event, endDate];
                    let start_ts: f64 = msg_send![start_date, timeIntervalSince1970];
                    let end_ts: f64 = msg_send![end_date, timeIntervalSince1970];

                    let calendar_obj: *mut AnyObject = msg_send![event, calendar];
                    let cal_title = if !calendar_obj.is_null() {
                        let cal_ns: *mut AnyObject = msg_send![calendar_obj, title];
                        ns_string_to_rust(cal_ns)
                    } else {
                        "Calendrier".to_string()
                    };

                    result.push(AppleCalendarEvent {
                        id,
                        title,
                        start_time: timestamp_to_iso(start_ts),
                        end_time: timestamp_to_iso(end_ts),
                        calendar_title: cal_title,
                    });
                }

                Ok(result)
            })
        }
    }

    /// Delete an event by its calendarItemIdentifier
    pub fn delete_event(event_id: &str) -> Result<bool, String> {
        unsafe {
            autoreleasepool(|_| {
                let alloc_store: *mut AnyObject = msg_send![class!(EKEventStore), alloc];
                let store: *mut AnyObject = msg_send![alloc_store, init];
                if store.is_null() {
                    return Err("Failed to create EKEventStore".to_string());
                }

                let id_ns = NSString::from_str(event_id);
                let event: *mut AnyObject = msg_send![
                    store,
                    calendarItemWithIdentifier: &*id_ns as *const NSString
                ];
                if event.is_null() {
                    return Ok(false);
                }

                let mut error: *mut AnyObject = std::ptr::null_mut();
                let success: bool = msg_send![
                    store,
                    removeEvent: event,
                    span: EK_SPAN_THIS_EVENT,
                    commit: true,
                    error: &mut error
                ];

                Ok(success)
            })
        }
    }

    fn parse_iso_to_timestamp(s: &str) -> Result<f64, String> {
        let s = s.trim_end_matches('Z');
        let dt = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
            .or_else(|_| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M"))
            .map_err(|e| format!("Invalid datetime '{s}': {e}"))?;
        Ok(dt.and_utc().timestamp() as f64)
    }

    fn timestamp_to_iso(ts: f64) -> String {
        use chrono::TimeZone;
        let dt = chrono::Utc
            .timestamp_opt(ts as i64, 0)
            .single()
            .unwrap_or_default();
        let local = dt.with_timezone(&chrono::Local);
        local.format("%Y-%m-%dT%H:%M:%S").to_string()
    }

    unsafe fn ns_string_to_rust(ns: *mut AnyObject) -> String {
        if ns.is_null() {
            return String::new();
        }
        let c_str: *const std::os::raw::c_char = msg_send![ns, UTF8String];
        if c_str.is_null() {
            return String::new();
        }
        std::ffi::CStr::from_ptr(c_str)
            .to_string_lossy()
            .into_owned()
    }
}
