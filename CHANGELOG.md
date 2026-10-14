# Changelog

## Unreleased

### Added

- DDP-061 / #29: Added Customer-scoped active-tab chatbot history, login/logout cleanup, stale-write guards, and storage/auth lifecycle tests.

- DDP-061 / #29: Added the shared-client chatbot service with documented request limits, canonical response validation, and service/API-client integration tests.

- DDP-021: Integrated the product catalog with backend APIs for product listing, product details, search, category, brand, minimum price, and maximum price filtering.
- Added loading, empty-result, and friendly API error states.
- Added automated tests for catalog integration and filter behaviour.

### Changed

- Product cards and product details now handle the fields returned by the backend API safely.
- Catalog API requests now use the environment-based API base URL.

### Removed

- Removed the legacy static product dataset and unused static catalog images.
