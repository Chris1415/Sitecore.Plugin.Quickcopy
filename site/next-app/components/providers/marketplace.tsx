"use client";

import {
  type ApplicationContext,
  ClientSDK,
} from "@sitecore-marketplace-sdk/client";
import { XMC } from "@sitecore-marketplace-sdk/xmc";
import type React from "react";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface ClientSDKProviderProps {
  children: ReactNode;
}

/**
 * T009b — QuickCopy MarketplaceProvider.
 *
 * Extends the scaffold's Provider to subscribe to `pages.context` via Path A
 * (`client.query('pages.context', { subscribe: true, onSuccess })`) per
 * `client.md § 6a` and § 4c-6. The verb-based `client.subscribe(...)` is
 * never used for this key — `pages.context` lives in `QueryMap`, not
 * `SubscribeMap`, and Path B fails typecheck (§ 4c-1).
 *
 * On unmount: the `unsubscribe` handle returned by `client.query` is invoked
 * AND `client.destroy()` tears down the PostMessage bridge.
 *
 * `usePagesContext()` returns the full `{ pageInfo, siteInfo }` snapshot, or
 * `null` until the first `onSuccess` event fires. We retain the *last
 * successful* payload across `onError` events so the panel does not regress
 * to a loading state on transient SDK failures.
 */

/**
 * Subset of the SDK's `PagesContext` shape (`client.md § 4 PagesContext`).
 * Declared locally so the Provider does not depend on a runtime type that may
 * not be exported at the SDK top level. All fields are optional per the
 * SDK contract — guard before use, never `as string`.
 */
export interface QuickCopyPagesContext {
  siteInfo?: {
    id?: string;
    name?: string;
    displayName?: string;
    language?: string;
    supportedLanguages?: string[];
  };
  pageInfo?: {
    id?: string;
    name?: string;
    version?: number;
    displayName?: string;
    path?: string;
    url?: string;
    language?: string;
    publishing?: {
      hasPublishableVersion?: boolean;
      isPublishable?: boolean;
    };
  };
}

const ClientSDKContext = createContext<ClientSDK | null>(null);
const AppContextContext = createContext<ApplicationContext | null>(null);
const PagesContextContext = createContext<QuickCopyPagesContext | null>(null);

export const MarketplaceProvider: React.FC<ClientSDKProviderProps> = ({
  children,
}) => {
  const [client, setClient] = useState<ClientSDK | null>(null);
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);
  const [pagesCtx, setPagesCtx] = useState<QuickCopyPagesContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Guard against StrictMode double-mount producing two `ClientSDK.init`
  // calls (T009a-TEST-1 idempotency assertion). Mirror pageshot's pattern.
  const initStartedRef = useRef<boolean>(false);

  // Hold the unsubscribe handle returned by
  // `client.query('pages.context', { subscribe: true })` so the cleanup
  // effect can invoke it exactly once on unmount.
  const pagesUnsubscribeRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (initStartedRef.current) {
      return;
    }
    initStartedRef.current = true;
    const init = async () => {
      const config = {
        target: window.parent,
        modules: [XMC],
      };
      try {
        setLoading(true);
        const created = await ClientSDK.init(config);
        setClient(created);
      } catch (err) {
        console.error("Error initializing client SDK", err);
        setError("Error initializing client SDK");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (!client) {
      return;
    }
    client.query("application.context").then((res) => {
      if (res?.data) {
        setAppContext(res.data);
      }
    });
  }, [client]);

  useEffect(() => {
    if (!client) {
      return;
    }

    let cancelled = false;

    // Path A subscription per `client.md § 6a`.
    client
      .query("pages.context", {
        subscribe: true,
        onSuccess: (data: unknown) => {
          // Fires on initial resolve AND on every subsequent update.
          const event = data as QuickCopyPagesContext | undefined;
          if (event) {
            setPagesCtx(event);
          }
        },
        onError: (err: unknown) => {
          // Per ADR-0009 we keep the last successful payload visible — the
          // per-button error states are the user-facing surface, not the
          // Provider state.
          console.error("[quickcopy][pages.context]", err);
        },
      })
      .then((res) => {
        if (cancelled) {
          // Component unmounted between query invocation and resolution —
          // tear down the subscription we just wired.
          (res as { unsubscribe?: () => void } | undefined)?.unsubscribe?.();
          return;
        }
        pagesUnsubscribeRef.current = (
          res as { unsubscribe?: () => void } | undefined
        )?.unsubscribe;
      });

    return () => {
      cancelled = true;
      pagesUnsubscribeRef.current?.();
      pagesUnsubscribeRef.current = undefined;
      client.destroy();
    };
  }, [client]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-dvh items-center justify-center bg-background p-6 text-sm text-muted-foreground"
      >
        Connecting to Sitecore Marketplace&hellip;
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center"
      >
        <h1 className="text-lg font-semibold text-danger-fg">
          Error initializing Marketplace SDK
        </h1>
        <p className="max-w-prose text-sm text-foreground">{error}</p>
        <p className="max-w-prose text-xs text-muted-foreground">
          Please check if the client SDK is loaded inside Sitecore Marketplace
          parent window and you have properly set your app&apos;s extension
          points.
        </p>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  if (!appContext) {
    return null;
  }

  return (
    <ClientSDKContext.Provider value={client}>
      <AppContextContext.Provider value={appContext}>
        <PagesContextContext.Provider value={pagesCtx}>
          {children}
        </PagesContextContext.Provider>
      </AppContextContext.Provider>
    </ClientSDKContext.Provider>
  );
};

export const useMarketplaceClient = () => {
  const context = useContext(ClientSDKContext);
  if (!context) {
    throw new Error(
      "useMarketplaceClient must be used within a ClientSDKProvider",
    );
  }
  return context;
};

export const useAppContext = () => {
  const context = useContext(AppContextContext);
  if (!context) {
    throw new Error("useAppContext must be used within a ClientSDKProvider");
  }
  return context;
};

/**
 * Read the live `pages.context` snapshot exposed by `<MarketplaceProvider>`.
 * Returns `null` until the SDK delivers the first `onSuccess` event. The
 * full `{ pageInfo, siteInfo }` payload is exposed so consumers can read
 * `pageInfo.id`, `pageInfo.version`, `pageInfo.displayName`, `pageInfo.name`,
 * `pageInfo.url`, `pageInfo.language`, `pageInfo.publishing`, `siteInfo.id`,
 * `siteInfo.name`, `siteInfo.language` directly without re-querying.
 *
 * Calling this hook outside the Provider returns `null`.
 */
export const usePagesContext = (): QuickCopyPagesContext | null => {
  return useContext(PagesContextContext);
};
