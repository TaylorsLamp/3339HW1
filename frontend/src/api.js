export async function api(url, method = 'GET', data) {
  let response;
  try {
    response = await fetch(`/api${url}`, {
      method,
      ...(data === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    });
  } catch {
    throw new Error('Cannot reach the server. Start the application and try again.');
  }
  let result;
  try { result = await response.json(); }
  catch { throw new Error('The server returned an invalid response. Please try again.'); }
  if (!response.ok) throw new Error(result.error || 'The request failed. Please try again.');
  return result;
}
