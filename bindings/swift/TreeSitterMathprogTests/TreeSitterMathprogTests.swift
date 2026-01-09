import XCTest
import SwiftTreeSitter
import TreeSitterMathprog

final class TreeSitterMathprogTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_mathprog())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Mathprog grammar")
    }
}
