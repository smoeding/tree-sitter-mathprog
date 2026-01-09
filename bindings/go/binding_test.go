package tree_sitter_mathprog_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_mathprog "github.com/smoeding/tree-sitter-mathprog/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_mathprog.Language())
	if language == nil {
		t.Errorf("Error loading Mathprog grammar")
	}
}
