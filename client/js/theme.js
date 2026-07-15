const THEME_STORAGE_KEY = "sharetrip-theme";
const THEME_STYLE_ID = "sharetrip-theme-styles";

const DARK_THEME_CSS = `
[data-theme="dark"] {
    color-scheme: dark;
}

[data-theme="dark"] body {
    background: #0f172a;
    color: #f1f5f9;
}

[data-theme="dark"] #navbar-root,
[data-theme="dark"] .navbar {
    background: #1e293b;
    border-bottom-color: #334155;
}

[data-theme="dark"] .nav-link {
    color: #cbd5e1;
}

[data-theme="dark"] .nav-link:hover,
[data-theme="dark"] .nav-link.active {
    color: #93c5fd;
}

[data-theme="dark"] .nav-menu-toggle {
    background: #243447;
    border-color: #475569;
}

[data-theme="dark"] .nav-menu-toggle span {
    background: #f1f5f9;
}

[data-theme="dark"] .nav-menu {
    background: #1e293b;
    border-bottom-color: #334155;
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .theme-toggle-btn {
    background: #243447;
    border-color: #475569;
}

[data-theme="dark"] .theme-toggle-btn:hover {
    background: #334155;
    border-color: #64748b;
}

[data-theme="dark"] .features-section {
    background: #111827;
}

[data-theme="dark"] .features-content h2,
[data-theme="dark"] .feature-card h3 {
    color: #f1f5f9;
}

[data-theme="dark"] .feature-card {
    background: #1e293b;
    border-color: #334155;
}

[data-theme="dark"] .feature-card p {
    color: #cbd5e1;
}

[data-theme="dark"] .site-footer {
    background: #0b1220;
    border-top-color: #334155;
    color: #cbd5e1;
}

[data-theme="dark"] body.dashboard-body,
[data-theme="dark"] body.donation-body {
    background: #0f172a;
}

[data-theme="dark"] .dashboard-header h1,
[data-theme="dark"] .route-title,
[data-theme="dark"] .form-panel-header h2,
[data-theme="dark"] .profile-name,
[data-theme="dark"] .profile-section-header h2,
[data-theme="dark"] .donation-hero h1,
[data-theme="dark"] .feedback-hero h1,
[data-theme="dark"] .messages-header h1,
[data-theme="dark"] .thread-header h1,
[data-theme="dark"] .ride-details-header h1 {
    color: #f1f5f9;
}

[data-theme="dark"] .dashboard-header p,
[data-theme="dark"] .eyebrow,
[data-theme="dark"] .profile-empty,
[data-theme="dark"] .review-meta,
[data-theme="dark"] .profile-notification-meta,
[data-theme="dark"] .no-comments,
[data-theme="dark"] .messages-header p,
[data-theme="dark"] body.dashboard-compose-mode .dashboard-header p:last-of-type {
    color: #cbd5e1;
}

[data-theme="dark"] .guest-ride-board-cta {
    background: #243447;
    border-color: #475569;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
}

[data-theme="dark"] .guest-ride-board-cta strong {
    color: #f8fafc !important;
}

[data-theme="dark"] .guest-ride-board-cta p {
    color: #cbd5e1 !important;
}

[data-theme="dark"] .ride-form-panel,
[data-theme="dark"] .ride-filter-panel,
[data-theme="dark"] .driver-offer-card,
[data-theme="dark"] .driver-offers-panel,
[data-theme="dark"] .donation-form,
[data-theme="dark"] .donation-history-item,
[data-theme="dark"] .review-card,
[data-theme="dark"] .profile-hero,
[data-theme="dark"] .profile-section,
[data-theme="dark"] .profile-hero-edit,
[data-theme="dark"] .thread-card,
[data-theme="dark"] .chat-panel,
[data-theme="dark"] .messages-sidebar,
[data-theme="dark"] .ride-details-card,
[data-theme="dark"] .comment-item,
[data-theme="dark"] .person-row,
[data-theme="dark"] .join-ride-dialog {
    background: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
}

[data-theme="dark"] .ride-card {
    background: linear-gradient(180deg, #2b3f5c 0%, #1f2f45 100%);
    border-left: 1px solid #4b607a;
    border-right: 1px solid #4b607a;
    border-top: 1px solid #4b607a;
    border-bottom: 1px solid #4b607a;
    box-shadow:
        0 16px 36px rgba(0, 0, 0, 0.42),
        0 0 0 1px rgba(148, 163, 184, 0.1);
    color: #e2e8f0;
}

[data-theme="dark"] .ride-card--offer {
    border-top: 3px solid #16a34a;
    border-bottom: 3px solid #16a34a;
}

[data-theme="dark"] .ride-card--offer-pending {
    border-top: 3px solid #f59e0b;
    border-bottom: 3px solid #f59e0b;
}

[data-theme="dark"] .ride-card--request {
    border-top: 3px solid #2563eb;
    border-bottom: 3px solid #2563eb;
}

[data-theme="dark"] .ride-type.offer {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
}

[data-theme="dark"] .ride-type.request {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
}

[data-theme="dark"] .ride-type.offer-pending,
[data-theme="dark"] .ride-status.pending-badge {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.4);
    color: #fde68a;
}

[data-theme="dark"] .ride-driver-info {
    color: #cbd5e1 !important;
}

[data-theme="dark"] .ride-driver-info strong {
    color: #e2e8f0 !important;
}

[data-theme="dark"] .ride-details,
[data-theme="dark"] .ride-details span,
[data-theme="dark"] .ride-people-title,
[data-theme="dark"] .comment-meta,
[data-theme="dark"] .person-row span,
[data-theme="dark"] .profile-stats,
[data-theme="dark"] .profile-gender,
[data-theme="dark"] .review-card-top strong,
[data-theme="dark"] .thread-preview,
[data-theme="dark"] .thread-meta,
[data-theme="dark"] .chat-message-meta,
[data-theme="dark"] .ride-price small,
[data-theme="dark"] .ride-card footer,
[data-theme="dark"] .form-panel-header p,
[data-theme="dark"] .ride-type-selector-label,
[data-theme="dark"] .ride-type-card p,
[data-theme="dark"] .join-guest-intro,
[data-theme="dark"] .guest-link-info span,
[data-theme="dark"] .guest-name-badge,
[data-theme="dark"] .donation-disclaimer,
[data-theme="dark"] .profile-section-header span,
[data-theme="dark"] .passenger-guest-list,
[data-theme="dark"] .ride-status:not(.pending-badge),
[data-theme="dark"] .driver-offer-card p {
    color: #cbd5e1;
}

[data-theme="dark"] .ride-card h2 {
    color: #f1f5f9;
}

[data-theme="dark"] .ride-type-card {
    background: transparent !important;
    border: 1.5px solid #475569 !important;
    color: #e2e8f0 !important;
}

[data-theme="dark"] .ride-type-card:hover {
    background: transparent !important;
    border-color: #64748b !important;
}

[data-theme="dark"] .ride-type-card.active {
    background: transparent !important;
    border: 2px solid #93c5fd !important;
}

[data-theme="dark"] .ride-type-card strong,
[data-theme="dark"] .join-guest-label,
[data-theme="dark"] .person-row strong,
[data-theme="dark"] .guest-link-info strong,
[data-theme="dark"] .guest-name-badge strong,
[data-theme="dark"] .ride-details-label,
[data-theme="dark"] .donation-hero h2,
[data-theme="dark"] .driver-offers-panel h3 {
    color: #f1f5f9;
}

[data-theme="dark"] .ride-details strong,
[data-theme="dark"] .ride-price,
[data-theme="dark"] .profile-rating-summary strong,
[data-theme="dark"] .donation-history-item strong {
    color: #f8fafc;
}

[data-theme="dark"] input,
[data-theme="dark"] select,
[data-theme="dark"] textarea {
    background: #243447;
    border-color: #475569;
    color: #f1f5f9;
}

[data-theme="dark"] select option {
    background: #243447;
    color: #f1f5f9;
}

[data-theme="dark"] .field-optional {
    color: #94a3b8;
}

[data-theme="dark"] input::placeholder,
[data-theme="dark"] textarea::placeholder {
    color: #94a3b8;
}

[data-theme="dark"] label,
[data-theme="dark"] .ride-filter-toggle,
[data-theme="dark"] .able-driver-toggle,
[data-theme="dark"] .profile-notification-filter {
    color: #cbd5e1;
}

[data-theme="dark"] .secondary-button,
[data-theme="dark"] .filter-toggle-btn,
[data-theme="dark"] .clear-search-link,
[data-theme="dark"] .cancel-form-link,
[data-theme="dark"] .details-link,
[data-theme="dark"] .feature-link,
[data-theme="dark"] .profile-notification-link,
[data-theme="dark"] .review-ride-link {
    background: #243447;
    border-color: #475569;
    color: #dbeafe;
}

[data-theme="dark"] .secondary-button:hover,
[data-theme="dark"] .filter-toggle-btn:hover {
    background: #334155;
    color: #eff6ff;
}

[data-theme="dark"] .ride-filter-tab {
    background: #243447;
    border-color: #475569;
    color: #cbd5e1;
}

[data-theme="dark"] .ride-filter-tab.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}

[data-theme="dark"] .notification-banner {
    background: transparent;
}

[data-theme="dark"] .notification-item {
    background: #1e3a5f;
    border-color: #334155;
    color: #dbeafe;
}

[data-theme="dark"] .notification-item.success {
    background: #14532d;
    border-color: #166534;
    color: #bbf7d0;
}

[data-theme="dark"] .notification-item.error {
    background: #7f1d1d;
    border-color: #991b1b;
    color: #fecaca;
}

[data-theme="dark"] .notification-item.pending,
[data-theme="dark"] .profile-notification-item.notification-item.pending {
    background: rgba(120, 53, 15, 0.55);
    border-color: rgba(251, 191, 36, 0.45);
    color: #fde68a;
}

[data-theme="dark"] .dashboard-message,
[data-theme="dark"] .site-fixed-alert {
    background: #14532d;
    border-color: #166534;
    color: #bbf7d0;
}

[data-theme="dark"] .dashboard-message.error,
[data-theme="dark"] .site-fixed-alert.error {
    background: #7f1d1d;
    border-color: #991b1b;
    color: #fecaca;
}

[data-theme="dark"] .profile-view-page,
[data-theme="dark"] .messages-page,
[data-theme="dark"] .message-thread-page {
    background: #0f172a;
}

[data-theme="dark"] .profile-notification-header-btn:disabled {
    opacity: 0.45;
}

[data-theme="dark"] .nav-profile-avatar.has-photo {
    background: #334155;
    border-color: #475569;
}

[data-theme="dark"] .nav-notification-badge {
    border-color: #1e293b;
}

[data-theme="dark"] .auth-panel,
[data-theme="dark"] .profile-panel {
    background: #1e293b;
    border-color: #334155;
    box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .auth-panel h2,
[data-theme="dark"] .profile-panel h2,
[data-theme="dark"] .auth-panel label,
[data-theme="dark"] .profile-panel label {
    color: #f1f5f9;
}

[data-theme="dark"] .how-it-works-page,
[data-theme="dark"] .how-it-works-content,
[data-theme="dark"] .donation-page,
[data-theme="dark"] .feedback-page,
[data-theme="dark"] .info-page {
    background: #0f172a;
    color: #e2e8f0;
}

[data-theme="dark"] .how-it-works-card,
[data-theme="dark"] .info-card,
[data-theme="dark"] .trust-section,
[data-theme="dark"] .safety-section {
    background: #1e293b;
    border-color: #334155;
}

[data-theme="dark"] .how-it-works-card h3,
[data-theme="dark"] .info-card h3,
[data-theme="dark"] .info-hero h1,
[data-theme="dark"] .info-card h2,
[data-theme="dark"] .trust-section h2,
[data-theme="dark"] .safety-section h2,
[data-theme="dark"] .safety-list h3 {
    color: #f1f5f9;
}

[data-theme="dark"] .how-it-works-card p,
[data-theme="dark"] .info-card p,
[data-theme="dark"] .info-hero p:last-child,
[data-theme="dark"] .info-card ol,
[data-theme="dark"] .trust-section p,
[data-theme="dark"] .safety-list p {
    color: #cbd5e1;
}

[data-theme="dark"] .chat-composer,
[data-theme="dark"] .pickup-row,
[data-theme="dark"] .guest-panel {
    border-color: #334155;
}

[data-theme="dark"] .chat-composer {
    background: #1e293b;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .chat-message.other {
    background: #243447;
    color: #e2e8f0;
}

[data-theme="dark"] .thread-list-past {
    opacity: 0.9;
}

[data-theme="dark"] .join-ride-backdrop {
    background: rgba(2, 6, 23, 0.72);
}

[data-theme="dark"] .join-ride-dialog h3 {
    color: #f1f5f9;
}

[data-theme="dark"] .join-ride-dialog p {
    color: #cbd5e1;
}

[data-theme="dark"] .join-ride-dialog label {
    color: #cbd5e1;
}

[data-theme="dark"] .join-guest-group {
    background: #243447;
    border-color: #475569;
}

[data-theme="dark"] .join-party-error {
    color: #fca5a5;
}

[data-theme="dark"] .ride-filter-tabs a {
    color: #cbd5e1;
}

[data-theme="dark"] .ride-filter-tabs a.active {
    background: #334155;
    color: #f8fafc;
}

[data-theme="dark"] .ride-filter-tabs {
    background: #243447;
}

[data-theme="dark"] .donation-form label,
[data-theme="dark"] .feedback-form label,
[data-theme="dark"] .donation-amounts legend,
[data-theme="dark"] .donation-history-item span,
[data-theme="dark"] .donation-history-item small,
[data-theme="dark"] .donation-history-item p,
[data-theme="dark"] .donation-hero p:not(.eyebrow),
[data-theme="dark"] .feedback-hero p:not(.eyebrow),
[data-theme="dark"] .ride-search-form label,
[data-theme="dark"] .form-panel-header p,
[data-theme="dark"] .cancel-form-link,
[data-theme="dark"] .clear-search-link,
[data-theme="dark"] .ride-comments-header span,
[data-theme="dark"] .comment-form label {
    color: #cbd5e1;
}

[data-theme="dark"] .driver-offer-card strong {
    color: #f1f5f9;
}

[data-theme="dark"] .ride-comments-header strong {
    background: #334155;
    color: #e2e8f0;
}

[data-theme="dark"] .ride-people,
[data-theme="dark"] .ride-comments {
    border-top-color: #475569;
}

[data-theme="dark"] .donation-amounts span {
    background: #243447;
    border-color: #475569;
    color: #e2e8f0;
}

[data-theme="dark"] .donation-amounts input:checked + span {
    background: #1e3a5f;
    border-color: #2563eb;
    color: #93c5fd;
}

[data-theme="dark"] .demo-payment-method {
    background: #243447;
    border-color: #475569;
}

[data-theme="dark"] .demo-payment-method strong {
    color: #cbd5e1;
}

[data-theme="dark"] .demo-payment-method span {
    background: rgba(245, 158, 11, 0.2);
    color: #fde68a;
}

[data-theme="dark"] .detail-card {
    background: #1e293b;
    border-color: #334155;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
}

[data-theme="dark"] .section-heading h2,
[data-theme="dark"] .detail-route {
    color: #f1f5f9;
}

[data-theme="dark"] .section-heading span {
    background: #334155;
    color: #e2e8f0;
}

[data-theme="dark"] .detail-summary-grid span {
    color: #cbd5e1;
}

[data-theme="dark"] .detail-summary-grid strong {
    color: #f1f5f9;
}

[data-theme="dark"] .detail-actions {
    border-top-color: #475569;
}

[data-theme="dark"] .back-link {
    color: #93c5fd;
}

[data-theme="dark"] .back-link:hover {
    color: #bfdbfe;
}

[data-theme="dark"] .demo-badge {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(251, 191, 36, 0.4);
    border-radius: 999px;
    color: #fde68a;
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 10px;
    white-space: nowrap;
}

[data-theme="dark"] .donation-history-item {
    background: #243447;
    border-color: #475569;
}

[data-theme="dark"] .ride-detail-page {
    background: #0f172a;
    color: #e2e8f0;
}

[data-theme="dark"] .profile-bio,
[data-theme="dark"] .profile-photo-editor-help,
[data-theme="dark"] .profile-edit-form label,
[data-theme="dark"] .profile-photo-editor-zoom label,
[data-theme="dark"] .review-comment,
[data-theme="dark"] .profile-notification-body p {
    color: #cbd5e1;
}

[data-theme="dark"] .profile-notification-route {
    color: #e2e8f0;
}

[data-theme="dark"] .profile-hero-info .profile-name,
[data-theme="dark"] .profile-edit-header h2,
[data-theme="dark"] .profile-section .profile-section-header h2 {
    color: #f1f5f9;
}

[data-theme="dark"] .profile-rating-summary {
    color: #cbd5e1;
}

[data-theme="dark"] .profile-rating-summary strong {
    color: #f8fafc;
}

[data-theme="dark"] .profile-stats span {
    background: #334155;
    border-color: #475569;
    color: #e2e8f0;
}

[data-theme="dark"] .profile-gender {
    background: #334155;
    border-color: #475569;
    color: #cbd5e1;
}

[data-theme="dark"] .able-driver-status.able-driver {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.35);
    color: #86efac;
}

[data-theme="dark"] .able-driver-status.not-able-driver {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(251, 191, 36, 0.4);
    color: #fde68a;
}

[data-theme="dark"] .profile-section-header span {
    background: #334155;
    color: #e2e8f0;
}

[data-theme="dark"] .profile-section-toggle {
    background: transparent;
    border: none;
    color: #94a3b8;
}

[data-theme="dark"] .profile-section-toggle:hover {
    background: transparent;
    color: #93c5fd;
}

[data-theme="dark"] .profile-notification-header-btn {
    background: #243447;
    border: 1px solid #475569;
    color: #dbeafe;
}

[data-theme="dark"] .profile-notification-header-btn:hover:not(:disabled) {
    background: #334155;
    color: #eff6ff;
}

[data-theme="dark"] .profile-notification-body p {
    color: #e2e8f0;
}

[data-theme="dark"] .review-card-top strong {
    color: #f1f5f9;
}

[data-theme="dark"] .trip-role-badge {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
}

[data-theme="dark"] .vehicle-details-section {
    border-top-color: #475569;
}

[data-theme="dark"] .vehicle-details-section h3 {
    color: #f1f5f9;
}

[data-theme="dark"] .vehicle-details-hint {
    color: #cbd5e1;
}

[data-theme="dark"] .profile-photo-upload,
[data-theme="dark"] .profile-photo-adjust {
    color: #93c5fd;
}

[data-theme="dark"] .profile-photo-remove {
    color: #94a3b8;
}

[data-theme="dark"] .profile-photo-remove:hover {
    color: #e2e8f0;
}

[data-theme="dark"] .profile-photo-editor-dialog {
    background: #1e293b;
    border: 1px solid #334155;
}

[data-theme="dark"] .profile-photo-editor-dialog h3 {
    color: #f1f5f9;
}

[data-theme="dark"] .messages-empty,
[data-theme="dark"] .messages-empty p,
[data-theme="dark"] .thread-date,
[data-theme="dark"] .thread-route,
[data-theme="dark"] .chat-empty-state,
[data-theme="dark"] .chat-message-author,
[data-theme="dark"] .chat-message-time,
[data-theme="dark"] .ride-detail-meta span,
[data-theme="dark"] .passenger-count-pill,
[data-theme="dark"] .comment-body,
[data-theme="dark"] .comments-empty,
[data-theme="dark"] .ride-details-meta,
[data-theme="dark"] .ride-details-meta span {
    color: #cbd5e1;
}

[data-theme="dark"] .thread-top-row strong,
[data-theme="dark"] .ride-detail-route {
    color: #f1f5f9;
}

[data-theme="dark"] .chat-message-bubble {
    background: #243447;
    color: #e2e8f0;
}

[data-theme="dark"] .passenger-count-pill {
    background: #334155;
}

[data-theme="dark"] .thread-row {
    background: #1e293b;
    border-color: #334155;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .thread-row.unread {
    border-color: #3b82f6;
}

[data-theme="dark"] .thread-avatar-fallback {
    background: #334155;
    color: #93c5fd;
}

[data-theme="dark"] .thread-past-badge {
    background: #334155;
    color: #cbd5e1;
}

[data-theme="dark"] .empty-rides {
    background: #1e293b;
    border-color: #334155;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
}

[data-theme="dark"] .empty-rides h2 {
    color: #f1f5f9;
}

[data-theme="dark"] .empty-rides p {
    color: #cbd5e1;
}

[data-theme="dark"] .full-rides-banner {
    background: rgba(30, 58, 95, 0.65);
    border-color: #475569;
    color: #dbeafe;
}

[data-theme="dark"] .full-rides-banner button {
    background: #2563eb;
    color: #ffffff;
}

[data-theme="dark"] .full-rides-banner button:hover {
    background: #1d4ed8;
}

[data-theme="dark"] .ride-detail-card {
    background: #1e293b;
    border-color: #334155;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
}

[data-theme="dark"] .ride-detail-card-header {
    border-bottom-color: #475569;
}

[data-theme="dark"] .ride-details-cell {
    border-color: #475569;
}

[data-theme="dark"] .ride-details-label {
    color: #cbd5e1;
}

[data-theme="dark"] .ride-details-value {
    color: #e2e8f0;
}

[data-theme="dark"] .ride-details-empty {
    color: #94a3b8;
}

[data-theme="dark"] .pickup-avatar {
    background: #334155;
    color: #93c5fd;
}

[data-theme="dark"] .pickup-name {
    color: #e2e8f0;
}

[data-theme="dark"] .pickup-spot {
    color: #cbd5e1;
}

[data-theme="dark"] .guest-link-row {
    background: #243447;
    border-color: #475569;
}

[data-theme="dark"] .guest-link-info strong {
    color: #e2e8f0;
}

[data-theme="dark"] .past-threads-toggle {
    border-color: #475569;
    color: #cbd5e1;
}

[data-theme="dark"] .past-threads-toggle:hover {
    background: #243447;
    color: #e2e8f0;
}

[data-theme="dark"] .threads-empty-note {
    color: #cbd5e1;
}

[data-theme="dark"] .ride-board-page-status {
    color: #cbd5e1;
}

[data-theme="dark"] .ride-board-page-input {
    background: #243447;
    border-color: #475569;
    color: #f1f5f9;
}

[data-theme="dark"] .field-hint {
    color: #cbd5e1;
}
`;

function injectThemeStyles() {
  let style = document.getElementById(THEME_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = THEME_STYLE_ID;
    style.textContent = DARK_THEME_CSS;
    document.head.appendChild(style);
  }

  document.head.appendChild(style);
}

function ensureThemeStylesLast() {
  const style = document.getElementById(THEME_STYLE_ID);
  if (style && style.parentNode) {
    document.head.appendChild(style);
  }
}

function getPreferredTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  localStorage.setItem(THEME_STORAGE_KEY, resolved);
  document.querySelectorAll(".theme-toggle-btn").forEach(updateThemeToggleButton);
}

function updateThemeToggleButton(button) {
  const isDark = getPreferredTheme() === "dark";
  const icon = button.querySelector(".theme-toggle-icon");
  if (icon) {
    const iconSrc = isDark ? "/images/theme-sun.png" : "/images/theme-moon.png";
    icon.innerHTML = `<img src="${iconSrc}" alt="" width="26" height="26">`;
  }
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  button.setAttribute("aria-label", label);
  button.title = label;
}

function createThemeToggleButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-toggle-btn";

  const icon = document.createElement("span");
  icon.className = "theme-toggle-icon";
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);

  button.addEventListener("click", () => {
    applyTheme(getPreferredTheme() === "dark" ? "light" : "dark");
  });

  updateThemeToggleButton(button);
  return button;
}

function mountThemeToggle(container) {
  if (!container || container.querySelector(".theme-toggle-btn")) {
    return;
  }
  container.insertBefore(createThemeToggleButton(), container.firstChild);
}

injectThemeStyles();
applyTheme(getPreferredTheme());

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ensureThemeStylesLast);
} else {
  ensureThemeStylesLast();
}

window.ShareTripTheme = {
  applyTheme,
  getPreferredTheme,
  mountThemeToggle,
  createThemeToggleButton,
};
