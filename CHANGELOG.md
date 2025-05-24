# Changelog

All notable changes to the Cloudflare AutoRAG MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-01-24

### Added
- **Cursor-based pagination support** for AI search tool only
  - New `cursor` parameter accepts pagination tokens from previous responses
  - AI search responses include `nextCursor` field for MCP compliance
  - Maintains backward compatibility (cursor is optional)

### Changed
- Version bumped to 1.2.0 to reflect new feature addition
- AI search responses now include `nextCursor` when more results are available

### Technical Notes
- Implements MCP-compliant cursor-based pagination pattern
- Only `autorag_ai_search` supports pagination (uses Cloudflare's `aiSearch` binding method)
- Basic and rewrite search use `search` binding method which doesn't support pagination
- Uses opaque cursor tokens for stateless pagination
- Enables iterative retrieval for large result sets
- Helps prevent LLM token window overflows

## [1.1.3] - 2025-01-24

### Changed
- **BREAKING**: Removed `filters` parameter from all search tools
- Improved error messages when filter parameters are attempted

### Added
- Custom error message directing users to REST API for filter functionality
- Comprehensive test suite with local artifact storage

### Fixed
- Eliminated confusing "Invalid input" errors when using filters
- Removed non-functional filter documentation

### Technical Notes
- Filters are not supported in Cloudflare Workers bindings, only in REST API
- This change aligns the API surface with actual Workers binding capabilities

## [1.1.2] - 2025-01-24

### Changed
- Attempted to fix filter format to use comparison operators

### Discovered
- Workers bindings don't support filters at all (REST API only)

## [1.1.1] - 2025-01-22

### Added
- `include_ai_response` parameter to AI search tool
- Default score threshold of 0.5 for all search tools
- Comprehensive parameter validation

## [1.1.0] - 2025-01-20

### Added
- Three distinct search tools:
  - `autorag_basic_search` - Pure vector search
  - `autorag_rewrite_search` - Search with query rewriting
  - `autorag_ai_search` - Full AI-powered search
- Boolean parameter support

## [1.0.0] - 2025-01-15

### Added
- Initial release
- Basic AutoRAG search functionality
- MCP server implementation
- Cloudflare Workers deployment support