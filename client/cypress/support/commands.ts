/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login as admin
       * @example cy.loginAsAdmin()
       */
      loginAsAdmin(email?: string, password?: string): Chainable<void>;
      
      /**
       * Custom command to login as team member
       * @example cy.loginAsTeam('passkey123')
       */
      loginAsTeam(passkey: string): Chainable<void>;
    }
  }
}

/**
 * Login as admin user
 */
Cypress.Commands.add('loginAsAdmin', (email = 'stratagem@intlabs.com', password = 'admin123') => {
  cy.visit('/');
  cy.wait(1000);
  cy.get('#loginAsAdmin').click();
  cy.get('#email').type(email);
  cy.get('#password').type(password);
  cy.get('button[type=submit]').click();
});

/**
 * Login as team member with passkey
 */
Cypress.Commands.add('loginAsTeam', (passkey: string) => {
  cy.visit('/');
  cy.get('#passkey').type(passkey);
  cy.get('button[type=submit]').click();
});

export {};

