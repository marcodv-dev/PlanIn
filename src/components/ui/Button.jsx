import './Button.css'

function Button({ text, img, icon, variant = 'primary', size = 'md', wide, fullWidth, onClick, type = 'button', className = '', square = '', style }) {
  const hasContent = text || img || icon
  const cls = [
    'cyber-btn',
    variant,
    size,
    wide ? 'wide' : '',
    fullWidth ? 'full' : '',
    className,
    square ? 'square' : ''
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={cls} onClick={onClick} style={style}>
      {hasContent && (
        <span className="btn-content">
          {img && <img src={img} alt="" />}
          {icon}
          {text && <span>{text}</span>}
        </span>
      )}
    </button>
  )
}

export default Button
