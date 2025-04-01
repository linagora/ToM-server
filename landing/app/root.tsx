import tailwindcss from './tailwind.css?url'
import animationStyles from './styles.css?url'
import type { LinksFunction } from '@remix-run/node'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration
} from '@remix-run/react'
import Nav from './components/nav'

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: tailwindcss },
  { rel: 'stylesheet', href: animationStyles }
]

export default function App(): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen w-full h-full  text-zinc-800 bg-gradient-to-r background-animate gradient-bg from-pink-500 via-orange-500 to-cyan-500">
        <Nav />
        <div className="w-full min-h-screen flex flex-col items-center bg-hero bg-fixed bg-repeat bg-cover	bg-right-bottom">
          <Outlet />
          <ScrollRestoration />
        </div>
        <Scripts />
      </body>
    </html>
  )
}
