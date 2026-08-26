import type { Metadata } from 'next'
import './globals.css'
import './ui-refresh.css'
import './ui-interactions.css'

export const metadata: Metadata = {
  title: 'Lumo CRM',
  description: 'CRM omnicanal para centralizar conversaciones, clientes y ventas.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>
}
