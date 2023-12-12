import { afterAll, beforeAll, beforeEach, describe, expect, it, assert } from 'vitest'
import supertest, { Response } from 'supertest'; 
import { app } from '../src/app';
import { knex } from '../src/database';
import { execSync } from 'node:child_process';

describe('Users routes', () => {
  let cookies: string[] = []; 

  beforeAll(async () => {
    // Configuração inicial
    await app.ready();
  });

  afterAll(async () => {
    // Limpeza após todos os testes
    await app.close();
  });

  beforeEach(() => {
    execSync('npm run knex migrate:rollback --all')
    execSync('npm run knex migrate:latest')
  })

  it('should be able to create a new account and list all meals', async () => {
    const timestamp = Date.now();
    const testEmail = `email${timestamp}@example.com`;

    // Dados de teste centralizados
    const testData = {
      name: 'testeUser',
      email: testEmail,
      address: 'Endereço de teste, 999',
      weight: 64.3,
      height: 170,
    };

    // Executando a requisição para criar um novo usuário
    const createUserResponse: Response = await supertest(app.server)
      .post('/users')
      .send(testData)
      .expect(201);

    // Assert para verificar se a resposta contém o sessionId no cookie
    const setCookieHeader = createUserResponse.headers['set-cookie'];
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    assert(cookies[0].includes('sessionId'), 'sessionId deve estar presente no cookie');

    // Assert para verificar se o usuário foi criado no banco de dados
    const createdUser = await findUserByEmail(testData.email);
    assert.isNotNull(createdUser, 'Usuário deve ser criado no banco de dados');

    if (createdUser) {
      assert.equal(createdUser.name, testData.name, 'O nome de usuário deve corresponder');
      assert.equal(createdUser.email, testData.email, 'O e-mail do usuário deve corresponder');
      assert.equal(createdUser.address, testData.address, 'O endereço do usuário deve corresponder');
      assert.equal(createdUser.weight, testData.weight, 'O peso do usuário deve corresponder');
      assert.equal(createdUser.height, testData.height, 'A altura do usuário deve corresponder');
    }

    // Dados da nova refeição
    const mealData = {
      name: 'Nova Refeição',
      description: 'Descrição da nova refeiçãoa',
      isOnTheDiet: true,
    };

    // Criando uma nova refeição para o usuário
    const createMealResponse: Response = await supertest(app.server)
      .post('/meals')
      .send(mealData)
      .set('Cookie', cookies)
      .expect(201);

    // Assert para verificar se a refeição foi criada com sucesso
    assert(createMealResponse.status === 201, 'Falha ao criar uma nova refeição');

    // Listando todas as refeições do usuário
    const listMealsResponse: Response = await supertest(app.server)
      .get('/meals')
      .set('Cookie', cookies)
      .expect(200);

    // Assert para verificar se a lista de refeições contém a nova refeição
    const meals = listMealsResponse.body.meals;
    const newMeal = meals.find((meal: { name: string }) => meal.name === mealData.name);

    assert.isNotNull(newMeal, 'Novas refeições devem estar na lista');
  });
});

async function findUserByEmail(email: string) {
  return knex.select('*').from('users').where({ email }).first();
}