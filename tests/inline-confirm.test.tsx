import {renderToStaticMarkup} from 'react-dom/server';
import {it,expect,vi} from 'vitest';
import {InlineConfirm,cancelWithEscape} from '../src/ui/InlineConfirm';

it.each([
  ['看解答','確定看解答（記為忘了）'],
  ['重設','確定重設'],
  ['結束','確定結束'],
])('renders %s as a trigger, then exposes distinct in-page confirm and cancel buttons', (label,confirmLabel)=>{
  const onConfirm=vi.fn(),onOpenChange=vi.fn();
  const render=(open:boolean)=>renderToStaticMarkup(<InlineConfirm {...{open,label,confirmLabel,onConfirm,onOpenChange}}/>);
  expect(render(false)).toBe('<button type="button">'+label+'</button>');
  const armed=render(true);
  expect(armed).toContain('role="group" aria-label="'+label+'"');
  expect(armed).toContain('>'+confirmLabel+'</button>');
  expect(armed).toContain('>取消</button>');
  expect(armed.match(/<button type="button"/g)).toHaveLength(2);
  expect(onConfirm).not.toHaveBeenCalled();
});

it('handles Escape as cancellation, without overriding native Tab or Enter behavior',()=>{
  const dismiss=vi.fn(),preventDefault=vi.fn(),stopPropagation=vi.fn();
  for(const key of ['Tab','Enter'])expect(cancelWithEscape({key,preventDefault,stopPropagation},dismiss)).toBe(false);
  expect(dismiss).not.toHaveBeenCalled();
  expect(cancelWithEscape({key:'Escape',preventDefault,stopPropagation},dismiss)).toBe(true);
  expect(dismiss).toHaveBeenCalledOnce();
  expect(preventDefault).toHaveBeenCalledOnce();expect(stopPropagation).toHaveBeenCalledOnce();
});
