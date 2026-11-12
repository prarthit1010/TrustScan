import { Link } from 'react-router-dom'
import Icon from './Icon'

export default function MobileBrand() {
  return (
    <Link to="/" className="m-brand">
      <span className="brand-mark"><Icon name="shieldCheck" size={16} /></span>
      TrustScan
    </Link>
  )
}
