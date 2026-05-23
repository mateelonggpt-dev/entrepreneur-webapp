"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";

type Params = Record<string, string | undefined>;

interface RouterCompatContextValue {
  pathname: string;
  params: Params;
}

const RouterCompatContext = createContext<RouterCompatContextValue | null>(null);

const normalizePath = (value: string) => {
  const url = new URL(value, "http://localhost");
  const pathname = url.pathname || "/";

  return pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
};

const isPathActive = (pathname: string, to: string, end?: boolean) => {
  const current = normalizePath(pathname);
  const target = normalizePath(to);

  if (target === "/") {
    return current === "/";
  }

  if (end) {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
};

const useRouterCompatContext = () => {
  const context = useContext(RouterCompatContext);

  if (!context) {
    throw new Error("Router compatibility hooks must be used inside <RouterCompatProvider>");
  }

  return context;
};

export const RouterCompatProvider = ({
  children,
  pathname,
  params,
}: {
  children: ReactNode;
  pathname: string;
  params: Params;
}) => (
  <RouterCompatContext.Provider value={{ pathname, params }}>
    {children}
  </RouterCompatContext.Provider>
);

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  children?: ReactNode;
}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ to, replace, children, ...props }, ref) => (
    <NextLink href={to} replace={replace} ref={ref} {...props}>
      {children}
    </NextLink>
  )
);

Link.displayName = "Link";

export interface NavLinkRenderProps {
  isActive: boolean;
  isPending: boolean;
}

export interface NavLinkProps extends Omit<LinkProps, "className" | "children"> {
  className?: string | ((props: NavLinkRenderProps) => string | undefined);
  children?: ReactNode | ((props: NavLinkRenderProps) => ReactNode);
  end?: boolean;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, replace, className, children, end, ...props }, ref) => {
    const { pathname } = useRouterCompatContext();
    const renderProps = {
      isActive: isPathActive(pathname, to, end),
      isPending: false,
    };
    const resolvedClassName =
      typeof className === "function" ? className(renderProps) : className;
    const resolvedChildren =
      typeof children === "function" ? children(renderProps) : children;

    return (
      <NextLink
        href={to}
        replace={replace}
        ref={ref}
        className={resolvedClassName}
        {...props}
      >
        {resolvedChildren}
      </NextLink>
    );
  }
);

NavLink.displayName = "NavLink";

export const useLocation = () => {
  const { pathname } = useRouterCompatContext();

  return {
    pathname,
    search: typeof window === "undefined" ? "" : window.location.search,
    hash: typeof window === "undefined" ? "" : window.location.hash,
  };
};

export const useParams = <T extends Params = Params>() => {
  const { params } = useRouterCompatContext();
  return params as T;
};

export const useNavigate = () => {
  const router = useRouter();

  return (to: string | number, options?: { replace?: boolean }) => {
    if (typeof to === "number") {
      if (typeof window !== "undefined") {
        window.history.go(to);
      }
      return;
    }

    if (options?.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
};

export const Navigate = ({ to, replace }: { to: string; replace?: boolean }) => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(to, { replace });
  }, [navigate, replace, to]);

  return null;
};
