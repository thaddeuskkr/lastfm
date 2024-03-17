FROM node:lts-alpine AS base
WORKDIR /lastfm
RUN apk --no-cache add \
    pixman \
    cairo \
    pango \
    giflib \
    libjpeg-turbo \
    librsvg
COPY package.json package-lock.json .
COPY fonts/ fonts/
COPY assets/ assets/

CMD ["node", "."]

FROM node:lts-alpine AS builder
WORKDIR /lastfm
RUN apk --no-cache --virtual .build-deps add \
        python3 \
        make \
        g++ && \
    apk --no-cache --virtual .canvas-build-deps add \
        build-base \
        cairo-dev \
        jpeg-dev \
        librsvg-dev \
        pango-dev \
        giflib-dev \
        pixman-dev \
        pangomm-dev \
        libjpeg-turbo-dev \
        freetype-dev
COPY src/ src/
COPY *.json .
RUN npm install --build-from-source --omit=dev && cp -R node_modules prod_node_modules
RUN npm install -g typescript && npm install --build-from-source && tsc
RUN apk del .build-deps && \
    apk del .canvas-build-deps

FROM base AS copier
COPY --from=builder /lastfm/prod_node_modules /lastfm/node_modules
COPY --from=builder /lastfm/dist /lastfm/dist