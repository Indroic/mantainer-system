"use client"

import * as React from "react"
import { Table as HeroTable } from "@heroui/react"

const Table = React.forwardRef<HTMLTableElement, React.ComponentProps<typeof HeroTable>>(
  (props, ref) => <HeroTable ref={ref} {...props} />
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<typeof HeroTable.Header>>(
  (props, ref) => <HeroTable.Header ref={ref} {...props} />
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<typeof HeroTable.Body>>(
  (props, ref) => <HeroTable.Body ref={ref} {...props} />
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.ComponentProps<typeof HeroTable.Row>>(
  (props, ref) => <HeroTable.Row ref={ref} {...props} />
);
TableRow.displayName = "TableRow";

const TableCell = React.forwardRef<HTMLTableCellElement, React.ComponentProps<typeof HeroTable.Cell>>(
  (props, ref) => <HeroTable.Cell ref={ref} {...props} />
);
TableCell.displayName = "TableCell";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ComponentProps<typeof HeroTable.Column>>(
  (props, ref) => <HeroTable.Column ref={ref} {...props} />
);
TableHead.displayName = "TableHead";

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.ComponentProps<typeof HeroTable.Footer>>(
  (props, ref) => <HeroTable.Footer ref={ref} {...props} />
);
TableFooter.displayName = "TableFooter";

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.ComponentProps<"caption">>(
  (props, ref) => <caption ref={ref} {...props} />
);
TableCaption.displayName = "TableCaption";

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  TableFooter,
  TableCaption,
}
export default Table;
