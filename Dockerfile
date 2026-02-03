# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build standalone binary
RUN bun build src/index.ts --compile --outfile=idp-octelium-sync

# Runtime stage - minimal image
FROM debian:bookworm-slim

WORKDIR /app

# Copy compiled binary
COPY --from=builder /app/idp-octelium-sync ./

# Create non-root user (use different name to avoid conflicts)
RUN useradd -r -u 1001 -s /bin/false appuser
USER appuser

ENTRYPOINT ["./idp-octelium-sync"]
