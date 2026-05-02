import { parseSourceFile, Node } from './ast';

export function runTests(): void {
    let sf = parseSourceFile('test.ts', 'let x = 1;');
    assert(sf != null, 'SourceFile should not be null');
    if (sf) {
        assert(sf.id == 1, 'Mock root ID should be 1');
        assert(sf.getKind() == 300, 'Mock kind should be 300');
    }
}
