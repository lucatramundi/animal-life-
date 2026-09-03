const tenantId = process.env.ENTRA_TENANT_ID;
const audience = process.env.ENTRA_API_AUDIENCE;
const requiredScope = "access_as_user";

if (!tenantId || !audience) {
    throw new Error(
        "ENTRA_TENANT_ID and ENTRA_API_AUDIENCE must be configured."
    );
}

const issuers = [
    `https://login.microsoftonline.com/${tenantId}/v2.0`,
    `https://sts.windows.net/${tenantId}/`
];
const clientId = audience.replace(/^api:\/\//, "");
const audiences = [clientId, `api://${clientId}`];
const jwksUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
);

let jwks;

async function getJwks() {
    if (!jwks) {
        const { createRemoteJWKSet } = await import("jose");
        jwks = createRemoteJWKSet(jwksUrl);
    }

    return jwks;
}

function getBearerToken(request) {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        const error = new Error("Missing bearer token.");
        error.statusCode = 401;
        throw error;
    }

    return authorization.slice("Bearer ".length).trim();
}

function requireScope(scopeClaim) {
    const scopes = (scopeClaim || "").split(" ");

    if (!scopes.includes(requiredScope)) {
        const error = new Error("The access token is missing the required scope.");
        error.statusCode = 403;
        throw error;
    }
}

function getTokenClaimSummary(token) {
    try {
        const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
        );

        return {
            issuer: payload.iss || null,
            audience: payload.aud || null,
            scopes: payload.scp || null,
            tenant: payload.tid || null
        };
    } catch {
        return { tokenClaims: 'unavailable' };
    }
}

async function authenticateRequest(request) {
    const token = getBearerToken(request);
    const { jwtVerify } = await import("jose");

    try {
        const { payload } = await jwtVerify(token, await getJwks(), {
            issuer: issuers,
            audience: audiences
        });

        requireScope(payload.scp);

        if (!payload.oid) {
            const error = new Error("The access token has no object ID claim.");
            error.statusCode = 401;
            throw error;
        }

        return {
            id: payload.oid,
            name: payload.name || payload.preferred_username || "ZPlay user",
            username: payload.preferred_username || null
        };
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }

        console.error(
            "Entra access-token validation failed:",
            error.message,
            {
                configuredTenant: tenantId,
                configuredAudience: audience,
                acceptedAudiences: audiences,
                ...getTokenClaimSummary(token)
            }
        );

        const authenticationError = new Error("Invalid or expired access token.");
        authenticationError.statusCode = 401;
        throw authenticationError;
    }
}

module.exports = {
    authenticateRequest
};