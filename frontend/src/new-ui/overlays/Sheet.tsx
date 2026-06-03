import type { DrawerProps } from './Drawer'
import { Drawer } from './Drawer'

export type SheetProps = Omit<DrawerProps, 'side'>

export function Sheet(props: SheetProps) {
  return <Drawer side="bottom" {...props} />
}
