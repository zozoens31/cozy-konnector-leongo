const { BaseKonnector, log } = require("cozy-konnector-libs");
const VENDOR = "leongo";
let vulog;
module.exports = new BaseKonnector(start);
const fetchVulog = (path, options = {}) => fetch(`${vulog.baseUrl}${path}`, {
    ...options,
    headers: {
        "X-API-Key": vulog.apiKey,
        ...(vulog.token && { authorization: `Bearer ${vulog.token}` }),
        ...options.headers,
    },
});
// The start function is run by the BaseKonnector instance only when it got all the account
// information (fields). When you run this connector yourself in "standalone" mode or "dev" mode,
// the account information come from ./konnector-dev-config.json file
// cozyParameters are static parameters, independents from the account. Most often, it can be a
// secret api key.
async function start(fields, cozyParameters) {
    log("info", "Authenticating ...");
    if (cozyParameters)
        log("debug", "Found COZY_PARAMETERS");
    vulog = cozyParameters.api;
    const token = await authenticate(fields.login, fields.password, cozyParameters.auth);
    if (token) {
        log("info", "Successfully logged in");
        vulog.token = token;
    }
    // The BaseKonnector instance expects a Promise as return of the function
    log("info", "Fetching the list of documents");
    const details = await fetchTripDetails();
    log("info", "Parsing list of documents");
    const documents = parseDetails(details);
    // Here we use the saveBills function even if what we fetch are not bills,
    // but this is the most common case in connectors
    log("info", "Saving data to Cozy");
    await this.saveBills(documents, fields, {
        // This is a bank identifier which will be used to link bills to bank operations. These
        // identifiers should be at least a word found in the title of a bank operation related to this
        // bill. It is not case sensitive.
        identifiers: ["Leo&go"],
    });
}
const authenticate = async (username, password, auth) => {
    const body = { username, password, ...auth.parameters };
    try {
        const response = await fetchVulog(auth.path, {
            headers: {
                "content-type": "application/x-www-form-urlencoded",
            },
            body: encodeURI(Object.entries(body)
                .map((kv) => kv.join("="))
                .join("&")),
            method: "POST",
        });
        if (response.status !== 200) {
            return false;
        }
        const result = await response.json();
        return result.access_token;
    }
    catch (error) {
        log("debug", error);
        return false;
    }
};
const fetchTripDetails = async () => {
    const now = new Date().toISOString().slice(0, 10);
    const response = await fetchVulog(`/apiv5/invoices/tripDetails?startDate=2013-02-01&endDate=${now}`);
    return response.json();
};
function parseDetails(details) {
    return details.map(({ invoice: { id, billingDate }, totalWithTax }) => ({
        amount: totalWithTax,
        date: new Date(billingDate),
        contractId: id,
        fileurl: `${vulog.baseUrl}/apiv5/invoices/${id}/pdf?access_token=${vulog.token}`,
        filename: `${VENDOR}_${billingDate}_${id}.pdf`,
        vendor: VENDOR,
        requestOptions: { headers: { "X-API-Key": vulog.apiKey } },
    }));
}
