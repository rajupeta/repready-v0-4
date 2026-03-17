#!/bin/bash
set -e

IMAGE_NAME="repready"
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
DOCKER_USER="${DOCKER_USERNAME}"

if [ -z "$DOCKER_USER" ]; then
  echo "Error: DOCKER_USERNAME environment variable is required"
  echo "Usage: DOCKER_USERNAME=yourusername ./scripts/deploy.sh"
  exit 1
fi

FULL_IMAGE="${REGISTRY}/${DOCKER_USER}/${IMAGE_NAME}:latest"

echo "Building Docker image..."
docker build -t "${IMAGE_NAME}" .

echo "Tagging as ${FULL_IMAGE}..."
docker tag "${IMAGE_NAME}" "${FULL_IMAGE}"

echo "Pushing to registry..."
docker push "${FULL_IMAGE}"

echo ""
echo "Done! Image pushed to: ${FULL_IMAGE}"
echo ""
echo "Next steps:"
echo "  1. Go to https://dashboard.render.com"
echo "  2. Update your Web Service to use image: ${FULL_IMAGE}"
echo "  3. Render will auto-deploy the new image"
