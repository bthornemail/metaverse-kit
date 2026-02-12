FROM nginx:alpine

# Static projection-only release envelope.
# Primary artifact remains dist/metaverse-kit-v0.1 produced by release:pack.
COPY dist/metaverse-kit-v0.1 /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
