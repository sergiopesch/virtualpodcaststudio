# Security Implementation Guide

This document outlines the security measures implemented in the Podcast Studio application.

## Security Features Implemented

### 1. Input Validation & Sanitization
- **Backend**: Pydantic validators for request models
- **Frontend**: Input validation in API routes
- **Topic Sanitization**: Regex-based filtering for arXiv topics
- **Length Limits**: Maximum topic length (50 characters) and count (10 topics)

### 2. CORS Configuration
- **Backend**: Environment-configurable allowed origins
- **Frontend**: Consistent CORS headers in API routes
- **Restricted Methods**: Only allow necessary HTTP methods (GET, POST, OPTIONS)
- **Restricted Headers**: Limited allowed headers for security

### 3. Rate Limiting
- **API Endpoints**: 100 requests per minute per IP
- **WebSocket Connections**: Rate limiting applied to prevent abuse
- **Configurable**: Rate limits can be adjusted via environment variables

### 4. Security Headers
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **X-XSS-Protection**: Enabled with blocking mode
- **Content-Security-Policy**: Restrictive CSP to prevent XSS
- **Referrer-Policy**: strict-origin-when-cross-origin

### 5. Error Handling
- **No Information Disclosure**: Generic error messages in production
- **Logging**: Detailed errors logged server-side only
- **HTTP Status Codes**: Appropriate status codes for different error types

### 6. Environment Configuration
- **API Keys**: Stored in environment variables only
- **URLs**: Configurable backend/frontend URLs
- **Development vs Production**: Environment-aware logging and error handling

### 7. WebSocket Security
- **Rate Limiting**: Applied to WebSocket connections
- **Connection Validation**: Basic validation before accepting connections
- **Error Handling**: Proper error codes and cleanup

## Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional (with defaults)
ALLOWED_ORIGINS=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

## Production Deployment Checklist

### Backend Security
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS in production
- [ ] Set proper CORS origins (no wildcards)
- [ ] Configure rate limiting for production load
- [ ] Use secure API key storage (e.g., AWS Secrets Manager)
- [ ] Enable request/response logging
- [ ] Set up monitoring and alerting

### Frontend Security
- [ ] Build with production optimizations
- [ ] Use HTTPS
- [ ] Configure proper CSP headers
- [ ] Remove development console.log statements
- [ ] Validate all user inputs
- [ ] Use environment variables for configuration

### Infrastructure Security
- [ ] Use firewalls to restrict access
- [ ] Keep dependencies updated
- [ ] Regular security audits
- [ ] SSL/TLS certificate management
- [ ] Database security (if applicable)

## Security Testing

Run these commands to test security:

```bash
# Check for vulnerable dependencies
npm audit
pip-audit  # or safety check

# Test rate limiting
curl -X POST http://localhost:8000/api/papers \
  -H "Content-Type: application/json" \
  -d '{"topics": ["cs.AI"]}' \
  --rate 200/minute

# Test CORS
curl -H "Origin: https://malicious-site.com" \
  -X POST http://localhost:8000/api/papers \
  -H "Content-Type: application/json" \
  -d '{"topics": ["cs.AI"]}'
```

## Reporting Security Issues

If you discover a security vulnerability, please:
1. Do not create a public GitHub issue
2. Email security concerns to the development team
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before disclosure

## Regular Security Maintenance

- Update dependencies monthly
- Review security logs weekly
- Conduct security audits quarterly
- Test backup and recovery procedures
- Monitor for new security advisories