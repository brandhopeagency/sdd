# URL map for domain routing.
# Variables are declared in variables.tf.
#
# NOTE: Workbench host rules are managed via gcloud scripts
# (scripts/gcloud/url-map-https.yaml) until fully migrated to Terraform.
# Only chat/www rules are defined here to avoid state conflicts.

resource "google_compute_url_map" "domain_access_map" {
  name            = "domain-access-map"
  default_service = google_compute_backend_service.production_domain_backend.id

  host_rule {
    hosts        = [var.production_domain]
    path_matcher = "production"
  }

  path_matcher {
    name            = "production"
    default_service = google_compute_backend_service.production_domain_backend.id
  }

  host_rule {
    hosts        = [var.production_www_domain]
    path_matcher = "www-redirect"
  }

  path_matcher {
    name = "www-redirect"

    default_url_redirect {
      host_redirect          = var.production_domain
      https_redirect         = true
      redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
      strip_query            = false
    }
  }
}
