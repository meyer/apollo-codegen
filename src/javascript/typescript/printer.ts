import * as t from '@babel/types';
import generate from '@babel/generator';
import * as prettier from 'prettier';

// can't use prettier.resolveConfig because it's async and Printer looks like it's expected to do things asynchronously.
const pkgJson = require('../../../package.json');
const prettierConfig = { ...pkgJson.prettier, parser: 'typescript' };

type Printable = t.Node | string;

export default class Printer {
  private printQueue: Printable[] = []

  public print(): string {
    return this.printQueue
      .reduce(
        (doc: string, printable) => {
          let str: string;
          if (typeof printable === 'string') {
            str = doc + printable;
          } else {
            const documentPart = generate(printable).code;
            str = doc + documentPart;
          }
          return prettier.format(str, prettierConfig);
        },
        ''
      );
  }

  public enqueue(printable: Printable) {
    this.printQueue = [
      ...this.printQueue,
      '\n',
      '\n',
      printable
    ];
  }

  public printAndClear() {
    const output = this.print();
    this.printQueue = [];
    return output;
  }
}
