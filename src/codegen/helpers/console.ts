// Console Helper Functions - Complete console.* method implementations

/**
 * Generate console helper functions for full console functionality
 */
export function generateConsoleHelpers(): string {
  return `
// Console helper functions
use std::collections::HashMap;
use std::time::Instant;
use std::io::Write;

static mut CONSOLE_COUNTS: Option<HashMap<String, usize>> = None;
static mut CONSOLE_TIMES: Option<HashMap<String, Instant>> = None;

fn get_console_counts() -> &'static mut HashMap<String, usize> {
    unsafe {
        if CONSOLE_COUNTS.is_none() {
            CONSOLE_COUNTS = Some(HashMap::new());
        }
        CONSOLE_COUNTS.as_mut().unwrap()
    }
}

fn get_console_times() -> &'static mut HashMap<String, Instant> {
    unsafe {
        if CONSOLE_TIMES.is_none() {
            CONSOLE_TIMES = Some(HashMap::new());
        }
        CONSOLE_TIMES.as_mut().unwrap()
    }
}

fn console_count(label: &str) {
    let counts = get_console_counts();
    let entry = counts.entry(label.to_string()).or_insert(0);
    *entry += 1;
    println!("Console Count ({}): {}", label, entry);
}

fn console_count_reset(label: &str) {
    let counts = get_console_counts();
    counts.insert(label.to_string(), 0);
    println!("Console Count Reset: {}", label);
}

fn console_time_start(label: &str) {
    let times = get_console_times();
    times.insert(label.to_string(), Instant::now());
    println!("Console Time: {} (started)", label);
}

fn console_time_end(label: &str) {
    let times = get_console_times();
    if let Some(start_time) = times.remove(label) {
        let duration = start_time.elapsed();
        let millis = duration.as_secs() as f64 + duration.subsec_nanos() as f64 / 1_000_000_000.0;
        println!("Console Time End: {}: {:.2}ms", label, millis * 1000.0);
    } else {
        println!("Console Time End: {} (not started)", label);
    }
}

fn console_table<T: std::fmt::Debug>(data: &[T]) {
    if data.is_empty() {
        println!("\\n┌────────────────┐");
        println!("│   (empty)      │");
        println!("└────────────────┘");
        return;
    }
    
    println!("\\n{}", format_table_basic(data));
}

fn format_table_basic<T: std::fmt::Debug>(data: &[T]) -> String {
    use std::fmt::Write;
    
    let mut output = String::new();
    
    // Check if first item looks like a struct
    let first_str = format!("{:?}", data[0]);
    let is_struct_like = first_str.contains('{') && first_str.contains('}');
    
    if is_struct_like {
        output = format_table_from_structs(data);
    } else {
        // Simple array of primitives
        let max_width = 50;
        writeln!(output, "┌────┬────┐").unwrap();
        writeln!(output, "│    │ {} │", "value").unwrap();
        writeln!(output, "├────┼────┤").unwrap();
        
        for (i, item) in data.iter().enumerate() {
            let item_str = format!("{:?}", item);
            let display_str = if item_str.len() > max_width {
                format!("{}...", &item_str[..max_width-3])
            } else {
                item_str
            };
            writeln!(output, "│ {:>3} │ {} │", i, display_str).unwrap();
        }
        
        writeln!(output, "└────┴────┘").unwrap();
    }
    
    output
}

fn format_table_from_structs<T: std::fmt::Debug>(data: &[T]) -> String {
    use std::fmt::Write;
    
    let mut output = String::new();
    
    // Extract field names and values from the first struct
    let first_str = format!("{:?}", data[0]);
    let fields = extract_struct_fields(&first_str);
    
    if fields.is_empty() {
        // Fallback to simple format
        return format_table_simple_fallback(data);
    }
    
    // Calculate column widths
    let mut col_widths = vec![3]; // Index column
    let mut headers = vec!["".to_string()];
    
    for field in &fields {
        headers.push(field.name.clone());
        col_widths.push(field.name.len().max(6));
    }
    
    // Check data to find max widths
    for item in data.iter().take(5) { // Limit to first 5 for performance
        let item_str = format!("{:?}", item);
        let item_fields = extract_struct_fields(&item_str);
        
        for (i, field) in item_fields.iter().enumerate() {
            let value_len = field.value.len(); // Don't limit value width
            if i + 1 < col_widths.len() {
                col_widths[i + 1] = col_widths[i + 1].max(value_len);
            }
        }
    }
    
    // Build table
    write!(output, "┌").unwrap();
    for (i, width) in col_widths.iter().enumerate() {
        if i > 0 { write!(output, "┬").unwrap(); }
        write!(output, "{}", "─".repeat(*width)).unwrap();
    }
    writeln!(output, "┐").unwrap();
    
    // Header
    write!(output, "│").unwrap();
    for (i, (header, width)) in headers.iter().zip(col_widths.iter()).enumerate() {
        if i > 0 { write!(output, "│").unwrap(); }
        write!(output, "{:<width$}", header, width = width).unwrap();
    }
    writeln!(output, "│").unwrap();
    
    // Separator
    write!(output, "├").unwrap();
    for (i, width) in col_widths.iter().enumerate() {
        if i > 0 { write!(output, "┼").unwrap(); }
        write!(output, "{}", "─".repeat(*width)).unwrap();
    }
    writeln!(output, "┤").unwrap();
    
    // Data rows
    for (i, item) in data.iter().enumerate() {
        write!(output, "│").unwrap();
        
        // Index
        write!(output, "{:<width$}", i.to_string(), width = col_widths[0]).unwrap();
        
        // Data
        let item_str = format!("{:?}", item);
        let item_fields = extract_struct_fields(&item_str);
        
        for (j, field) in item_fields.iter().enumerate() {
            if j + 1 < col_widths.len() {
                write!(output, "│").unwrap();
                // Don't truncate - show full values
                let display_value = field.value.clone();
                write!(output, "{:<width$}", display_value, width = col_widths[j + 1]).unwrap();
            }
        }
        
        // Fill remaining columns
        for j in item_fields.len() + 1..col_widths.len() {
            write!(output, "│").unwrap();
            write!(output, "{:<width$}", "", width = col_widths[j]).unwrap();
        }
        
        writeln!(output, "│").unwrap();
    }
    
    // Bottom border
    write!(output, "└").unwrap();
    for (i, width) in col_widths.iter().enumerate() {
        if i > 0 { write!(output, "┴").unwrap(); }
        write!(output, "{}", "─".repeat(*width)).unwrap();
    }
    write!(output, "┘").unwrap();
    
    output
}

fn format_table_simple_fallback<T: std::fmt::Debug>(data: &[T]) -> String {
    use std::fmt::Write;
    
    let mut output = String::new();
    
    writeln!(output, "┌────┬──────────────────────────┐").unwrap();
    writeln!(output, "│    │ item                     │").unwrap();
    writeln!(output, "├────┼──────────────────────────┤").unwrap();
    
    for (i, item) in data.iter().enumerate() {
        let item_str = format!("{:?}", item);
        let display_str = if item_str.len() > 25 {
            format!("{}...", &item_str[..22])
        } else {
            item_str
        };
        writeln!(output, "│ {:>3} │ {} │", i, display_str).unwrap();
    }
    
    writeln!(output, "└────┴──────────────────────────┘").unwrap();
    
    output
}

struct StructField {
    name: String,
    value: String,
}

fn extract_struct_fields(s: &str) -> Vec<StructField> {
    let mut fields = Vec::new();
    
    // Find the struct content between braces
    let start = s.find('{');
    let end = s.rfind('}');
    
    if let (Some(start_idx), Some(end_idx)) = (start, end) {
        if start_idx < end_idx {
            let content = &s[start_idx + 1..end_idx];
            
            // Split by comma to get individual fields
            for field_str in content.split(',') {
                let field_str = field_str.trim();
                if field_str.is_empty() {
                    continue;
                }
                
                // Split by colon to get name and value
                if let Some(colon_idx) = field_str.find(':') {
                    let name = field_str[..colon_idx].trim();
                    let value = field_str[colon_idx + 1..].trim();
                    
                    if !name.is_empty() && !value.is_empty() {
                        // Clean up the value - remove quotes
                        let clean_value = if value.starts_with('"') && value.ends_with('"') {
                            value[1..value.len()-1].to_string()
                        } else {
                            value.to_string()
                        };
                        
                        // Only add if we haven't seen this field name yet
                        let already_exists = fields.iter().any(|f: &StructField| f.name == name);
                        if !already_exists {
                            fields.push(StructField {
                                name: name.to_string(),
                                value: clean_value,
                            });
                        }
                    }
                }
            }
        }
    }
    
    fields
}

fn console_clear() {
    print!("\\x1b[H\\x1b[2J\\x1b[3J");
    std::io::stdout().flush().unwrap();
}
`;
}