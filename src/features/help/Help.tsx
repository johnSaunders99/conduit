import html from '../../../docs/guide.md'
export default function Help() {
  return <article className="panel guide" aria-label="使用說明">
    <div className="eyebrow">渠成　 /　學習手冊</div>
    <div dangerouslySetInnerHTML={{__html:html}} />
  </article>
}
