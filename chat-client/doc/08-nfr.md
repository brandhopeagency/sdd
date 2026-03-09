# Non-Functional Requirements

[← Back to README](./README.md)

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial Load (LCP) | < 2.5s | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| Chat Response Display | < 500ms | After API response |
| Workbench Table Render | < 1s | 1000 rows |
| Search Debounce | 300ms | User input |
| API Response Time (P95) | < 500ms | Server-side |

---

## Accessibility Standards (WCAG 2.1 AA)

| Criterion | Requirement |
|-----------|-------------|
| 1.1.1 Non-text Content | All images have alt text |
| 1.3.1 Info and Relationships | Semantic HTML, ARIA labels |
| 1.4.3 Contrast (Minimum) | 4.5:1 for normal text, 3:1 for large text |
| 2.1.1 Keyboard | All functionality keyboard accessible |
| 2.4.3 Focus Order | Logical tab order |
| 2.4.7 Focus Visible | Clear focus indicators |
| 3.2.2 On Input | No unexpected context changes |
| 4.1.2 Name, Role, Value | Custom components have ARIA |

---

## Browser Support Matrix

| Browser | Minimum Version | Support Level |
|---------|-----------------|---------------|
| Chrome | 90+ | Full |
| Firefox | 88+ | Full |
| Safari | 14+ | Full |
| Edge | 90+ | Full |
| Mobile Safari | iOS 14+ | Full |
| Chrome Android | 90+ | Full |
| Internet Explorer | - | Not Supported |

---

## Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| HTTPS | All traffic encrypted (TLS 1.2+) |
| Authentication | JWT with secure httpOnly cookies |
| Session Timeout | 30 minutes inactivity |
| CSRF Protection | Token-based |
| XSS Prevention | Content Security Policy, input sanitization |
| Rate Limiting | 100 requests/minute per user |
| Audit Logging | All admin actions logged |

---

## Internationalization

- Default language: English (en-US)
- Text externalized for future translation
- RTL layout support ready
- Date/time formatting locale-aware
- Number formatting locale-aware

---

## Error Handling

| Scenario | User Experience |
|----------|-----------------|
| Network Failure | Retry with exponential backoff, offline indicator |
| API Error (4xx) | User-friendly error message, suggested action |
| API Error (5xx) | Generic error, retry option, support contact |
| Session Expired | Redirect to login with return URL |
| Invalid Route | 404 page with navigation options |

---

[← Back to README](./README.md) | [Next: Appendix →](./09-appendix.md)

