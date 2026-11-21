import {lazyChunk} from '../../ui/ChunkRecovery';
import {Suspense} from 'react';
import type {WorkspaceProps} from './Workspace';
const Workspace=lazyChunk(()=>import('./Workspace'));
export default function LazyWorkspace(props:WorkspaceProps){return <Suspense fallback={<p role="status">正在啟動 SQL 引擎…</p>}><Workspace {...props}/></Suspense>}
