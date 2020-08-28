#!/bin/bash

# Exit on failure
set -e

# Set current working directory
cd "$(dirname "$0")"

# Pull changes (if any)
git pull

# Install npm packages
npm install

# Clean build directory
rm -rf dist

# Build production artifact
npm run prod

# Set newly built artifact to production
rm -rf production
mv dist production

