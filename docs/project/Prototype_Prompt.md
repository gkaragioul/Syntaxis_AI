### 📝 Summary

InvoiceExtractor is a focused SaaS tool that converts invoice PDFs into clean Excel/CSV data for small businesses and freelancers. Users sign up with email/password, upload invoice PDFs, review and correct extracted data, create vendor templates for repeat suppliers, and export accounting-ready spreadsheets. The platform uses simple subscription billing and focuses on solving the specific pain point of manual invoice data entry.


### 🎨 Style Definition

- Clean, professional look focused on invoice processing (blue/green color scheme)
- Responsive, mobile-friendly layouts (single-column on mobile, multi-panel on desktop)
- High-contrast buttons and clear status indicators for processing progress
- Simple modals for subscription management and error details
- Inline validation and real-time feedback on invoice upload and field editing
- Editable grids for invoice line items and field correction
- Toast notifications for processing status and subscription updates
- Dashboard with cards for recent invoices, usage stats, and vendor templates


### 🧭 User Journey and Actions (Field Intelligence + Bulk Processing Focus)

**Single Invoice Processing:**
- User signs up with email/password (premium free tier automatically activated)
- User uploads single invoice PDF (drag-and-drop or file picker)
- Upload progress and advanced OCR processing shown; errors surfaced inline
- System intelligently extracts invoice fields handling terminology variations
- **High Confidence**: Data shown with green checkmarks, ready for export
- **Uncertain Fields**: Smart field mapping interface with side-by-side PDF view

**Bulk Invoice Processing:**
- User uploads 50-500 invoice PDFs via bulk upload interface
- System analyzes batch and provides processing estimates and vendor recognition
- **Intelligent Grouping**: Invoices grouped by vendor, confidence, and similarity
- **Auto-Processing**: High-confidence invoices processed automatically with progress tracking
- **Batch Review**: Uncertain invoices grouped intelligently for efficient review
- **Cross-Invoice Learning**: System learns patterns across multiple invoices in batch

**Universal Actions:**
- User reviews confident extractions and maps uncertain fields visually
- System learns from user corrections to improve future accuracy (single and batch)
- User can save adaptive vendor templates that remember field terminology
- User exports perfectly accurate data as Excel/CSV (individual or bulk)
- User manages subscription, usage limits, and intelligent vendor templates
- User upgrades to business/enterprise tier for advanced bulk processing features
- Error states show helpful guidance with field mapping suggestions and batch optimization


### 🧱 Required Data Entities

- **User**: `id`, `email`, `password_hash`, `subscription_status`, `invoices_processed_this_month`, `subscription_id`, `created_at`
- **Invoice**: `id`, `user_id`, `filename`, `file_path`, `processing_status`, `created_at`
- **InvoiceData**: `id`, `invoice_id`, `user_id`, `vendor_name`, `invoice_number`, `invoice_date`, `total_amount`, `line_items` (JSONB), `user_edited`, `created_at`
- **InvoiceTemplate**: `id`, `user_id`, `vendor_name`, `extraction_patterns` (JSONB), `created_at`
- **Export**: `id`, `invoice_data_id`, `format`, `file_path`, `created_at`


### 📦 Deliverables (Field Intelligence + Bulk Processing UI)

1. Sign Up & Tiered Subscription Management Flow (Pro/Business/Enterprise)
2. Dashboard (Recent Invoices, Bulk Processing Stats, Accuracy Metrics, Vendor Templates)
3. Single & Bulk Invoice Upload Interface (1 invoice or 50-500 invoices)
4. Intelligent Batch Analysis & Processing (Vendor Recognition, Grouping, Progress Tracking)
5. Advanced Field Extraction & Review (Confidence Indicators & Field Mapping)
6. Smart Bulk Review Interface (Intelligent Grouping, Batch Field Mapping)
7. Cross-Invoice Learning Interface (Pattern Recognition, Template Building)
8. Adaptive Vendor Template Creation & Management (Single & Bulk Learning)
9. Perfect Export & Download Results (Individual & Bulk CSV/Excel)
10. Bulk Processing Analytics & Optimization (Processing Insights, Performance Metrics)
11. Error Handling & Smart Suggestions (Single & Bulk Processing)
12. Mobile Variants for All Screens with Bulk Processing Support
13. Enterprise Subscription Management with Bulk Processing Guarantees


### 1️⃣ Sign Up & License Activation Flow

#### Layout and Design
- Centered, single-column form for sign up (email, password, confirm password)
- On first login, blocking modal overlays app: “Enter your CD-key/license code”

#### Components
- Email/password fields with inline validation
- “Sign Up” and “Log In” buttons (primary, disabled until valid)
- License entry modal: CD-key input, “Activate” button, “Contact Support” link

#### Behavior
- All fields required; real-time validation (email format, password strength)
- License modal blocks all other actions until valid CD-key is entered
- On activation, device is registered and user proceeds to dashboard
- If device limit reached, modal shows list of registered devices with “Deactivate” option

#### Error States
- Invalid/expired CD-key: red inline error, disables “Activate”
- Device already registered: modal with device list, “Deactivate” button
- Expired license: modal with renewal instructions and “Contact Support”


### 2️⃣ Dashboard (Templates, License, Device Management)

#### Layout and Design
- Multi-tab or card layout: “Templates”, “License & Devices”, “Recent Jobs”
- License status and device info always visible (top or sidebar)
- “Add Template”, “Deactivate Device”, “Renew License” buttons

#### Components
- Template list: name, created/updated, actions (view, edit, delete, apply)
- Device list: device name/fingerprint, status, “Deactivate” button
- License info: type, status, expiry, “Renew” button if applicable
- Recent jobs: file name, status, date, “View Results”/“Download”/“Error Log”

#### Behavior
- Deactivating a device prompts confirmation modal
- License renewal opens modal with payment/renewal instructions
- Template actions open respective modals or detail views

#### Error States
- License expired: persistent banner, disables all processing actions
- Device conflict: modal with resolution steps


### 3️⃣ PDF Upload & Batch Selection

#### Layout and Design
- Prominent drag-and-drop area and “Select Files” button
- List of selected files with size, status, and remove option

#### Components
- File picker, drag-and-drop zone
- File list: name, size, status (queued, uploading, error)
- “Upload” button (primary, disabled if no valid files)
- Max file size and supported format info

#### Behavior
- Multiple files can be selected at once (batch)
- Upload progress bar per file
- Remove file from queue before upload
- On upload, files validated (size, format); errors shown inline

#### Error States
- File too large/unsupported: red inline error, file not added to queue
- Corrupt PDF: error shown after upload, file marked as failed


### 4️⃣ Table Detection & Review (Editable Grid)

#### Layout and Design
- Full-width, scrollable data grid (AG Grid or similar)
- Table selector (if multiple tables detected)
- Extraction logic panel (header row, columns, filters, etc.)

#### Components
- Data grid: editable cells, row/column controls
- Table/page selector dropdown
- Extraction logic form: page, table index, header row, columns, filters
- “Save as Template”, “Re-run Extraction”, “Apply Template” buttons

#### Behavior
- User can edit any cell, add/remove rows/columns
- Changes auto-saved or require explicit “Save” (configurable)
- “Re-run Extraction” reprocesses file with current logic
- “Save as Template” opens modal for template name/description

#### Error States
- No tables found: banner with troubleshooting tips
- Extraction failed: error log modal, “Download Error Report” button


### 5️⃣ Template Creation & Management

#### Layout and Design
- Modal or side panel for creating/editing templates
- List view for all saved templates

#### Components
- Template form: name, description, extraction logic fields (JSON editor or form)
- “Save”, “Cancel”, “Delete” buttons
- Template list: name, last used, actions (edit, delete, apply)

#### Behavior
- Inline validation for required fields and logic format
- Editing a template updates logic for future jobs (not retroactive)
- Deleting prompts confirmation modal

#### Error States
- Invalid logic: inline error, disables “Save”
- Template incompatible with PDF: error banner when applying


### 6️⃣ Batch Processing & Job Status Notifications

#### Layout and Design
- Job status panel (sidebar or dashboard card)
- Toast notifications for job updates (processing, complete, failed)
- Email notification settings in user profile

#### Components
- Job list: file name, status (processing, complete, failed), progress bar
- “View Results”, “Download”, “Error Log” buttons per job
- Notification bell icon with unread count

#### Behavior
- Jobs processed in background; status auto-updates
- Clicking notification opens job details or error log
- Email sent on batch completion or failure (toggle in settings)

#### Error States
- Batch failure: error log downloadable, banner with summary
- Job stuck: “Retry” button, support link


### 7️⃣ Export & Download Results

#### Layout and Design
- Export panel with format selection (Excel, CSV)
- Download links for each processed file

#### Components
- Format selector (radio or dropdown)
- File list: name, export status, download link, “Retry Export” if failed
- “Export All” button (batch), disabled if no jobs complete

#### Behavior
- User selects format, clicks “Export” (single or batch)
- Download links appear when ready
- Failed exports show error log and “Retry” button

#### Error States
- Export failed: red status, error log modal, troubleshooting tips
- Download link expired: “Regenerate” button


### 8️⃣ Error Handling & Reporting (Modals, Logs)

#### Layout and Design
- Error modals for blocking issues (license, device, extraction failure)
- Inline error banners/messages for recoverable issues
- Downloadable error logs (plain text or CSV)

#### Components
- Error modal: title, message, “Download Log”, “Contact Support”
- Inline error banners (top of screen or within affected component)
- “Retry” and “Dismiss” buttons

#### Behavior
- Blocking errors prevent further action until resolved
- Download log provides detailed error info (file, job, template)
- “Contact Support” opens mailto or support form

#### Error States
- All error states must be actionable (retry, fix, or contact support)
- Edge cases (corrupt PDF, template mismatch, device conflict) have specific messages and next steps


### 9️⃣ Mobile Variants for All Screens

#### Layout and Design
- All layouts collapse to single-column
- Buttons expand to full width
- Modals become full-screen overlays
- Data grid scrolls horizontally; table selector always visible

#### Components
- Hamburger menu for dashboard navigation
- Floating action buttons for key actions (upload, export, add template)
- Swipe gestures for removing files/devices/templates

#### Behavior
- All interactions optimized for touch
- File picker uses native mobile controls
- Notifications and error banners stack at top of screen


### 🔟 Validation, Disabled, and Edge States

#### Form Validation
- All required fields show red border and inline error on invalid input
- Disabled buttons until all validations pass
- Password and CD-key fields masked, with “show/hide” toggle

#### Disabled States
- Processing disables upload/export/template actions
- License expired disables all processing/export actions

#### Edge Cases
- Duplicate device: modal with device list and deactivation option
- Corrupt/unsupported PDF: error banner, file marked as failed
- Template mismatch: error banner, option to adjust or create new template
- Export/download failure: error log, “Retry” button

#### Session Timeout
- Full-page modal: “Session expired. Please log in again.”  
- Login redirects to last attempted path

#### Unauthorized Access
- Redirect to `/login` with flash message: “Please sign in to continue.”