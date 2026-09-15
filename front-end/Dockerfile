FROM node:24-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json ./
COPY front-end/package.json ./front-end/package.json
RUN npm ci -w front-end --include-workspace-root
COPY front-end ./front-end
WORKDIR /app/front-end
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/front-end/dist /usr/share/nginx/html
COPY front-end/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
