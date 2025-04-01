import type { MetaFunction } from '@remix-run/node'
import Hero from '../components/hero'
import MatrixInfo from '../components/matrix-info'

export const meta: MetaFunction = () => {
  return [{ title: 'Twake on Matrix' }]
}

export default function Index(): JSX.Element {
  return (
    <div className="flex flex-col w-full m-auto h-auto">
      <Hero />
      <MatrixInfo />
    </div>
  )
}
