export default {
  async fetch(request, environment) {
    const response = await environment.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") {
      return response;
    }

    const url = new URL(request.url);
    if (url.pathname.includes(".")) {
      return response;
    }

    url.pathname = "/index.html";
    return environment.ASSETS.fetch(new Request(url, request));
  },
};
