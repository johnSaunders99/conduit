import {existsSync} from 'node:fs'
import {it,expect} from 'vitest'
import {inspect} from '../tools/content.mjs'
import {assembleCatalog} from '../src/content/catalog'
import {buildDayPlan} from '../src/lib/planner'
import {defaults} from '../src/lib/model'

it(
  'starts a fresh fixture plan with the Windows lessons in sequence',()=>{
    const {index,deck}=inspect('fixtures/content')
    const catalog=assembleCatalog(index,deck)
    const input={catalog,done:new Set<string>(),day:'2026-11-20',at:'2026-11-20T08:00:00Z',
      choice:{format:defaults.format,scope:defaults.scope,tracks:defaults.tracks},reviewIds:[],reviewMinutes:0}
    const start=['fd-demo-01-files','fd-demo-02-paths','fd-demo-03-values']
    const recommended=buildDayPlan({...input,focus:'recommended',budget:{mode:'time',value:120}})
    expect(recommended.items.slice(0,3)).toEqual(start)
    const focused=buildDayPlan({...input,focus:'query',budget:{mode:'time',value:60}})
    expect(focused.items.slice(0,2)).toEqual(start.slice(0,2))
  },30000)
