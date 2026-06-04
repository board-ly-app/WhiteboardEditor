# Just mirrors the default Mongo image.
# Allows the image to be easily cached locally.

# Mongo <8.0 required for compatibility with Linux kernel 6.19+.
# Details: https://www.mongodb.com/community/forums/t/mongodb-8-x-and-linux-kernel-6-19/337547
# Should be bumped to latest stable release on resolution of the issue.
FROM mongo:7.0 AS release

# No other build steps.

EXPOSE 27017
