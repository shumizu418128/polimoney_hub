FROM denoland/deno:2.1.4

# Install useful tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Create non-root user
ARG USERNAME=deno
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && chown -R $USERNAME:$USERNAME /deno-dir

USER $USERNAME

# Cache dependencies on build (optional, speeds up startup)
# COPY deno.json deno.lock* ./
# RUN deno cache src/index.ts

