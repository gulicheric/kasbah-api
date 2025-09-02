# Use the official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install any needed packages
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Make port 3001 available to the world outside this container
EXPOSE 3001

# Set environment variable
ENV NODE_ENV=production

# Define the command to run the application
CMD ["node", "src/auth-server.js"]