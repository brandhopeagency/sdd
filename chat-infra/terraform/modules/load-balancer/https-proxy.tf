resource "google_compute_target_https_proxy" "domain_access_https_proxy" {
  name = "domain-access-https-proxy"

  url_map = google_compute_url_map.domain_access_map.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.production_certificate.self_link
  ]
}
