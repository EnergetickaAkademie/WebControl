FROM node:20-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

FROM nginx:alpine
COPY --from=build /src/dist/frontend/browser /usr/share/nginx/html
# Copy will be handled by docker-compose volume mount
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
