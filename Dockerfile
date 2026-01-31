######### BASE stage ##########

FROM jelastic/nodejs:20.14.0-pm2-almalinux-9 AS base


WORKDIR /app

# add `/app/node_modules/.bin` to $PATH
ENV PATH=/app/node_modules/.bin:$PATH

# Installing nodes dependencies
COPY package.json ./
COPY package-lock.json ./

RUN npm i -g @nestjs/cli

RUN npm install


# Installing Infisical secret manager
RUN curl -1sLf \
'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.rpm.sh' | sh \ 
&& yum install -y infisical

ARG ENVIRONMENT
ENV ENVIRONMENT=$ENVIRONMENT

ARG BACKEND_VERSION
ENV BACKEND_VERSION=$BACKEND_VERSION

# Copy everything (except .dockerignore items)
COPY . ./

ENV NODE_OPTIONS="--max-old-space-size=8192 --enable-source-maps --stack-trace-limit=1000 "

######### DEV stage ##########

FROM base AS dev

# Disable nodejs service on startup, as we are using our own starting script in dev
RUN systemctl disable nodejs

# Default program
CMD [ "npm", "run", "start:dev"]



######### TESTPROD stage ##########
#### (only used to test production docker image in dev env)

FROM base AS testprod


###############################
#ENV INFISICAL_CLIENT_ID=
#ENV INFISICAL_SECRET=
#ENV INFISICAL_PROJECT_ID=
###############################


#ENV HOME_DIR=/app/
#ENV NODE_ENV=production
#ENV ROOT_DIR=/app/dist/src
#ENV WEBROOT=/app/

# Creates a "dist" folder with the production build
#RUN npm run build

# Create log directory
#RUN mkdir -p /var/log/baztille
#RUN chmod 777 /var/log/baztille

# Default program
# Note: infisical is setting the correct environment values before starting service



######### PROD stage ##########

FROM base AS prod

ENV HOME_DIR=/app/
ENV NODE_ENV=production
ENV ROOT_DIR=/app/dist/src
ENV WEBROOT=/app/

# Creates a "dist" folder with the production build
RUN npm run build

# Create log directory
RUN mkdir -p /var/log/baztille
RUN chmod 777 /var/log/baztille

RUN ls -l /opt/.nvm/versions/node/*/bin/ > /var/log/nodebin.log


CMD ["/opt/.nvm/versions/node/*/bin/pm2-runtime", "ecosystem.config.js"]

