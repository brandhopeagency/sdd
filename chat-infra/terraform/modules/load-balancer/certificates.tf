# SSL certificate covering all managed domains (chat + workbench).
# Variables are declared in variables.tf.

resource "google_compute_managed_ssl_certificate" "production_certificate" {
  name = "mentalhelp-production-cert"

  managed {
    domains = [
      var.production_domain,
      var.production_www_domain,
      var.workbench_prod_domain,
      var.workbench_prod_api_domain,
      var.workbench_dev_domain,
      var.workbench_dev_api_domain,
    ]
  }
}
