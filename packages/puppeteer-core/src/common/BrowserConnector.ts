/**
 * @license
 * Copyright 2023 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Browser } from '../api/Browser.js';
import { _connectToCdpBrowser } from '../cdp/BrowserConnector.js';
import { assert } from '../util/assert.js';
import { isErrorLike } from '../util/ErrorLike.js';

import type { ConnectionTransport } from './ConnectionTransport.js';
import type { ConnectOptions } from './ConnectOptions.js';
import type { Logger } from './Debug.js';
import { assertSupportedUrlRestrictions } from './util.js';

const getWebSocketTransportClass = async () => {
  return (await import('../common/BrowserWebSocketTransport.js'))
        .BrowserWebSocketTransport;
};

/**
 * Users should never call this directly; it's called when calling
 * `puppeteer.connect`. This method attaches Puppeteer to an existing browser instance.
 *
 * @internal
 */
export async function _connectToBrowser(
  options: ConnectOptions & {logger: Logger},
): Promise<Browser> {
  assertSupportedUrlRestrictions(options);
  const {connectionTransport, endpointUrl} =
    await getConnectionTransport(options);

  if (options.protocol === 'webDriverBiDi') {
    throw new Error(
      'WebDriver BiDi protocol is not supported in this build of Puppeteer',
    );
  } else {
    const cdpBrowser = await _connectToCdpBrowser(
      connectionTransport,
      endpointUrl,
      options,
      options.logger,
    );
    return cdpBrowser;
  }
}

/**
 * Establishes a websocket connection by given options and returns both transport and
 * endpoint url the transport is connected to.
 * @internal
 */
async function getConnectionTransport(
  options: ConnectOptions & {logger: Logger},
): Promise<{connectionTransport: ConnectionTransport; endpointUrl: string}> {
  const {browserWSEndpoint, browserURL, channel, transport} = options;
  // `wsOptions.headers` supersedes the deprecated top-level `headers`.
  const headers = options.wsOptions?.headers ?? options.headers ?? {};
  const wsOptions = options.wsOptions ?? {};

  assert(
    Number(!!browserWSEndpoint) +
      Number(!!browserURL) +
      Number(!!transport) +
      Number(!!channel) ===
      1,
    'Exactly one of browserWSEndpoint, browserURL, transport or channel must be passed to puppeteer.connect',
  );

  if (transport) {
    return {connectionTransport: transport, endpointUrl: ''};
  } else if (browserWSEndpoint) {
    const WebSocketClass = await getWebSocketTransportClass();
    const connectionTransport: ConnectionTransport =
      await WebSocketClass.create(
        browserWSEndpoint,
        headers,
        options.logger,
        wsOptions,
      );
    return {
      connectionTransport: connectionTransport,
      endpointUrl: browserWSEndpoint,
    };
  } else if (browserURL) {
    const connectionURL = await getWSEndpoint(browserURL, headers);
    const WebSocketClass = await getWebSocketTransportClass();
    const connectionTransport: ConnectionTransport =
      await WebSocketClass.create(
        connectionURL,
        headers,
        options.logger,
        wsOptions,
      );
    return {
      connectionTransport: connectionTransport,
      endpointUrl: connectionURL,
    };
  } else if (options.channel) {
    throw new Error("channel is not supported in this environment");
  }
  throw new Error('Invalid connection options');
}

async function getWSEndpoint(
  browserURL: string,
  headers?: Record<string, string>,
): Promise<string> {
  const endpointURL = getWSEndpointURL(browserURL);

  try {
    const result = await globalThis.fetch(endpointURL, {
      method: 'GET',
      headers,
    });
    if (!result.ok) {
      throw new Error(`HTTP ${result.statusText}`);
    }
    const data = await result.json();
    return data.webSocketDebuggerUrl;
  } catch (error) {
    if (isErrorLike(error)) {
      error.message =
        `Failed to fetch browser webSocket URL from ${endpointURL}: ` +
        error.message;
    }
    throw error;
  }
}

export function getWSEndpointURL(browserURL: string): string {
  const endpointURL = new URL(browserURL);
  endpointURL.pathname =
    endpointURL.pathname.replace(/\/?$/, '') + '/json/version';
  endpointURL.hash = '';
  return endpointURL.toString();
}
